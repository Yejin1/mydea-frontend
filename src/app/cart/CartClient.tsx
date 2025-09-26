"use client";
import { useEffect, useState, useCallback } from "react";
import styles from "./cart.module.css";
import { PretendardRegular, PretendardExtraBold } from "../fonts";

interface CartItem {
  itemId: number;
  workId: number;
  name: string;
  thumbUrl?: string | null;
  unitPrice: number;
  quantity: number;
  optionHash?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface FetchState {
  loading: boolean;
  error: string | null;
}

export default function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: true,
    error: null,
  });
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const parseOptionHash = (hash?: string | null): Record<string, unknown> => {
    if (!hash) return {};
    try {
      return JSON.parse(hash);
    } catch {
      return {};
    }
  };

  const fetchItems = useCallback(async () => {
    setFetchState({ loading: true, error: null });
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (res.status === 401) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `장바구니 조회 실패 (${res.status})`);
      }
      const text = await res.text();
      if (!text.trim()) {
        setItems([]);
        setTotal(0);
        setFetchState({ loading: false, error: null });
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("응답 JSON 파싱 실패");
      }
      if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        const maybeItems = obj.items;
        if (Array.isArray(maybeItems)) {
          const typed: CartItem[] = maybeItems.filter(
            (v): v is CartItem => !!v && typeof v === "object" && "itemId" in v
          ) as CartItem[];
          setItems(typed);
          const tVal = obj.total;
          if (typeof tVal === "number") setTotal(tVal);
          else
            setTotal(typed.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
        } else if (Array.isArray(data)) {
          // fallback handled below
        }
      } else if (Array.isArray(data)) {
        // 하위 호환: 바로 배열이면 total 재계산
        setItems(data as CartItem[]);
        setTotal(
          (data as CartItem[]).reduce((s, i) => s + i.quantity * i.unitPrice, 0)
        );
      } else {
        setItems([]);
        setTotal(0);
      }
      setFetchState({ loading: false, error: null });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "장바구니 로드 오류";
      setFetchState({ loading: false, error: msg });
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function changeQuantity(item: CartItem, delta: number) {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    setUpdatingIds((prev) => new Set(prev).add(item.itemId));
    try {
      const res = await fetch("/api/cart/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId, quantity: newQty }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `수량 변경 실패 (${res.status})`);
      }
      setItems((prev) =>
        prev.map((p) =>
          p.itemId === item.itemId ? { ...p, quantity: newQty } : p
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "수량 변경 실패");
    } finally {
      setUpdatingIds((prev) => {
        const n = new Set(prev);
        n.delete(item.itemId);
        return n;
      });
    }
  }

  async function removeItem(item: CartItem) {
    if (!confirm("삭제하시겠습니까?")) return;
    setRemovingIds((prev) => new Set(prev).add(item.itemId));
    try {
      const res = await fetch(`/api/cart/items/${item.itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `삭제 실패 (${res.status})`);
      }
      setItems((prev) => prev.filter((p) => p.itemId !== item.itemId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setRemovingIds((prev) => {
        const n = new Set(prev);
        n.delete(item.itemId);
        return n;
      });
    }
  }

  function formatPrice(v: number) {
    return v.toLocaleString() + "원";
  }

  if (fetchState.loading) {
    return <div className={styles.cartPage}>로딩중...</div>;
  }
  if (fetchState.error) {
    return (
      <div className={styles.cartPage}>
        <div style={{ color: "#ff4d4f", fontSize: 14 }}>{fetchState.error}</div>
        <button onClick={fetchItems} style={{ marginTop: 12 }}>
          재시도
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.cartPage} ${PretendardRegular.className}`}>
      <div className={styles.headingRow}>
        <h1 className={`${styles.title} ${PretendardExtraBold.className}`}>
          장바구니
        </h1>
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>장바구니가 비어 있습니다.</div>
      ) : (
        <>
          <div className={styles.itemsTableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 280 }}>상품</th>
                  <th>옵션</th>
                  <th>단가</th>
                  <th>수량</th>
                  <th>소계</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const option = parseOptionHash(item.optionHash);
                  return (
                    <tr key={item.itemId}>
                      <td>
                        <div className={styles.thumbCell}>
                          <div className={styles.thumbImgWrapper}>
                            {item.thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.thumbUrl} alt={item.name} />
                            ) : (
                              <span style={{ fontSize: 12, color: "#999" }}>
                                NO IMG
                              </span>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: "#666" }}>
                              #{item.workId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        {Object.entries(option)
                          .slice(0, 6)
                          .map(([k, v]) => (
                            <span key={k} className={styles.badgeOption}>
                              {k}:{String(v)}
                            </span>
                          ))}
                        {Object.keys(option).length > 6 && (
                          <span className={styles.badgeOption}>
                            +{Object.keys(option).length - 6}
                          </span>
                        )}
                      </td>
                      <td>{formatPrice(item.unitPrice)}</td>
                      <td>
                        <div className={styles.qtyControl}>
                          <button
                            className={styles.qtyBtn}
                            disabled={
                              updatingIds.has(item.itemId) || item.quantity <= 1
                            }
                            onClick={() => changeQuantity(item, -1)}
                          >
                            -
                          </button>
                          <input
                            className={styles.qtyInput}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 1 && val <= 999) {
                                changeQuantity(item, val - item.quantity);
                              }
                            }}
                          />
                          <button
                            className={styles.qtyBtn}
                            disabled={
                              updatingIds.has(item.itemId) ||
                              item.quantity >= 999
                            }
                            onClick={() => changeQuantity(item, +1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>{formatPrice(item.unitPrice * item.quantity)}</td>
                      <td>
                        <button
                          className={styles.removeBtn}
                          disabled={removingIds.has(item.itemId)}
                          onClick={() => removeItem(item)}
                        >
                          {removingIds.has(item.itemId) ? "삭제중" : "삭제"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.summaryBox}>
            <div className={styles.summaryLine}>
              <span>총 수량</span>
              <span>{totalQty}</span>
            </div>
            <div className={`${styles.summaryLine} ${styles.summaryTotal}`}>
              <span>합계</span>
              <span>{formatPrice(total || subtotal)}</span>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={styles.checkoutBtn}
                onClick={() => alert("결제 기능은 준비 중입니다.")}
              >
                주문 진행
              </button>
              <button
                className={styles.continueBtn}
                onClick={() => (window.location.href = "/customizer")}
              >
                더 담기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
