"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import styles from "./cart.module.css";
import { PretendardRegular, PretendardExtraBold } from "../fonts";

interface CartItem {
  cartItemId: number; // unique PK (서버 보장)
  workId: number;
  name: string;
  thumbUrl?: string | null;
  unitPrice: number;
  quantity: number; // 서버에 저장된 확정 수량
  optionHash?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type Status = "idle" | "loading" | "error" | "ready";

// --- Utils (컴포넌트 밖으로 분리) -----------------------------------------
function parseOptionHash(hash?: string | null): Record<string, unknown> {
  if (!hash) return {};
  try {
    return JSON.parse(hash);
  } catch {
    return {};
  }
}

function formatPrice(v: number) {
  return v.toLocaleString() + "원";
}

export default function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set()); // PATCH 진행 중
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [draftQty, setDraftQty] = useState<Record<number, number>>({});

  // 파생 값 메모
  const totalQty = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items]
  );
  const computedTotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    [items]
  );

  const fetchItems = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (res.status === 401) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (!res.ok) {
        throw new Error(`장바구니 조회 실패 (${res.status})`);
      }
      interface CartResponse {
        items: CartItem[];
        total?: number;
      }
      const data: CartResponse = await res.json();
      const arr = Array.isArray(data.items) ? data.items : [];
      setItems(arr);
      // 서버 total 이 없으면 단순 재계산
      const t =
        typeof data.total === "number"
          ? data.total
          : arr.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      setServerTotal(t);
      // draft 초기화
      setDraftQty(
        arr.reduce<Record<number, number>>((acc, it) => {
          acc[it.cartItemId] = it.quantity;
          return acc;
        }, {})
      );
      setStatus("ready");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "장바구니 로드 오류";
      setErrorMsg(msg);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Draft 수정 (실제 PATCH 전까지는 로컬 상태만)
  function adjustDraft(item: CartItem, delta: number) {
    setDraftQty((prev) => {
      const cur = prev[item.cartItemId] ?? item.quantity;
      const next = cur + delta;
      if (next < 1 || next > 999) return prev;
      return { ...prev, [item.cartItemId]: next };
    });
  }

  function setDraftDirect(item: CartItem, raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 1 || val > 999) return;
    setDraftQty((prev) => ({ ...prev, [item.cartItemId]: val }));
  }

  async function applyQuantity(item: CartItem) {
    const targetQty = draftQty[item.cartItemId];
    if (targetQty == null || targetQty === item.quantity) return; // 변경 없음

    // TODO (#3): PATCH /api/cart/items 구현 후 응답 스펙 확정되면 성공 시 서버 total 갱신 여부 논의
    setUpdatingIds((prev) => new Set(prev).add(item.cartItemId));
    try {
      const res = await fetch("/api/cart/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItemId: item.cartItemId,
          quantity: targetQty,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `수량 변경 실패 (${res.status})`);
      }
      setItems((prev) =>
        prev.map((p) =>
          p.cartItemId === item.cartItemId ? { ...p, quantity: targetQty } : p
        )
      );
      // 서버 total 을 다시 받아야 정확하지만 (쿠폰/배송 등), 현재는 단순 재계산으로 대체.
      setServerTotal((prev) => {
        // optimistic: 이전 total 에 증감 반영 (정확성 > 단순성 필요 시 fetchItems() 다시 호출)
        const diff = (targetQty - item.quantity) * item.unitPrice;
        return prev + diff;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "수량 변경 실패");
      // 실패 시 draft 를 기존 수량으로 롤백
      setDraftQty((prev) => ({ ...prev, [item.cartItemId]: item.quantity }));
    } finally {
      setUpdatingIds((prev) => {
        const n = new Set(prev);
        n.delete(item.cartItemId);
        return n;
      });
    }
  }

  async function removeItem(item: CartItem) {
    if (!confirm("삭제하시겠습니까?")) return;
    setRemovingIds((prev) => new Set(prev).add(item.cartItemId));
    try {
      const res = await fetch(`/api/cart/items/${item.cartItemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("이미 삭제되었거나 찾을 수 없습니다.");
        }
        const txt = await res.text();
        throw new Error(txt || `삭제 실패 (${res.status})`);
      }
      setItems((prev) => prev.filter((p) => p.cartItemId !== item.cartItemId));
      setDraftQty((prev) => {
        const clone = { ...prev };
        delete clone[item.cartItemId];
        return clone;
      });
      // optimistic total 조정
      setServerTotal((prev) => prev - item.quantity * item.unitPrice);
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setRemovingIds((prev) => {
        const n = new Set(prev);
        n.delete(item.cartItemId);
        return n;
      });
    }
  }

  if (status === "loading") {
    return <div className={styles.cartPage}>로딩중...</div>;
  }
  if (status === "error") {
    return (
      <div className={styles.cartPage}>
        <div className={styles.errorMsg}>{errorMsg}</div>
        <button onClick={fetchItems} className={styles.retryBtn}>
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
                  <th className={styles.productColWidth}>상품</th>
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
                  const draft = draftQty[item.cartItemId] ?? item.quantity;
                  const qtyChanged = draft !== item.quantity;
                  return (
                    <tr key={item.cartItemId}>
                      <td>
                        <div className={styles.thumbCell}>
                          <div className={styles.thumbImgWrapper}>
                            {item.thumbUrl ? (
                              <Image
                                src={item.thumbUrl}
                                alt={item.name}
                                fill={false}
                                width={56}
                                height={56}
                                className={styles.thumbImg}
                                sizes="56px"
                                priority={false}
                              />
                            ) : (
                              <span className={styles.noImg}>NO IMG</span>
                            )}
                          </div>
                          <div>
                            <div className={styles.itemName}>{item.name}</div>
                            <div className={styles.itemWorkId}>
                              #{item.workId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.optionsCell}>
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
                              updatingIds.has(item.cartItemId) || draft <= 1
                            }
                            onClick={() => adjustDraft(item, -1)}
                          >
                            -
                          </button>
                          <input
                            className={styles.qtyInput}
                            value={draft}
                            onChange={(e) =>
                              setDraftDirect(item, e.target.value)
                            }
                          />
                          <button
                            className={styles.qtyBtn}
                            disabled={
                              updatingIds.has(item.cartItemId) || draft >= 999
                            }
                            onClick={() => adjustDraft(item, +1)}
                          >
                            +
                          </button>
                          <button
                            className={[
                              styles.applyBtn,
                              updatingIds.has(item.cartItemId)
                                ? styles.applyBtnLoading
                                : "",
                              !qtyChanged ? styles.applyBtnDisabled : "",
                            ].join(" ")}
                            disabled={
                              updatingIds.has(item.cartItemId) || !qtyChanged
                            }
                            onClick={() => applyQuantity(item)}
                          >
                            적용
                          </button>
                        </div>
                      </td>
                      <td>{formatPrice(item.unitPrice * item.quantity)}</td>
                      <td>
                        <button
                          className={styles.removeBtn}
                          disabled={removingIds.has(item.cartItemId)}
                          onClick={() => removeItem(item)}
                        >
                          {removingIds.has(item.cartItemId) ? "삭제중" : "삭제"}
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
              <span>
                {formatPrice(serverTotal || computedTotal)}
                {serverTotal !== computedTotal && (
                  <span className={styles.totalDiff}>
                    (계산:{formatPrice(computedTotal)})
                  </span>
                )}
              </span>
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
