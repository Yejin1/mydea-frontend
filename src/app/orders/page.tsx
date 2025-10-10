"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./orders.module.css";

type OrderItem = {
  orderItemId: number;
  workId: number;
  name: string;
  optionHash: string;
  thumbUrl?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

type OrderResponse = {
  orderId: number;
  orderNo: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  recipientName: string;
  phone: string;
  address1: string;
  address2?: string | null;
  zipcode: string;
  note?: string | null;
  createdAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  canceledAt?: string | null;
  items?: OrderItem[];
};

type Page<T> = {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso || "-";
  }
}
function localizeStatus(status: string): string {
  switch (status) {
    case "CREATED":
      return "생성됨";
    case "PAYMENT_PENDING":
      return "결제 대기";
    case "PAID":
      return "결제 완료";
    case "PROCESSING":
      return "처리 중";
    case "PACKED":
      return "포장 완료";
    case "SHIPPED":
      return "배송 중";
    case "DELIVERED":
      return "배송 완료";
    case "COMPLETED":
      return "구매 확정";
    case "CANCELED":
      return "취소됨";
    case "EXPIRED":
      return "만료";
    case "PAYMENT_FAILED":
      return "결제 실패";
    default:
      return status;
  }
}

function OrdersPageInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageData, setPageData] = useState<Page<OrderResponse> | null>(null);

  const page = useMemo(() => {
    const p = Number(search.get("page") || "0");
    return Number.isFinite(p) && p >= 0 ? p : 0;
  }, [search]);
  const size = useMemo(() => {
    const s = Number(search.get("size") || "20");
    return Number.isFinite(s) && s > 0 ? s : 20;
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({
          page: String(page),
          size: String(size),
        });
        const res = await fetch(`/api/orders?${qs}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) throw new Error("로그인이 필요합니다.");
          const t = await res.text();
          throw new Error(t || `주문 목록 조회 실패 (${res.status})`);
        }
        const data: Page<OrderResponse> = await res.json();
        if (!cancelled) setPageData(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "조회 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, size]);

  const goPage = (p: number) => {
    const params = new URLSearchParams(search.toString());
    params.set("page", String(p));
    params.set("size", String(size));
    router.replace(`/orders?${params.toString()}`);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>주문 목록</h1>
      {loading && <div>불러오는 중...</div>}
      {error && <div className={styles.error}>{error}</div>}
      {!loading && !error && pageData && (
        <>
          {pageData.empty ? (
            <div className={styles.empty}>주문이 없습니다.</div>
          ) : (
            <div className={styles.list}>
              {pageData.content.map((o) => (
                <div key={o.orderId} className={styles.card}>
                  <div className={styles.row}>
                    <div>
                      <div>
                        <strong>주문번호 : {o.orderNo}</strong>
                      </div>
                      <div className={styles.orderMeta}>
                        주문일: {formatDate(o.createdAt)}
                      </div>
                    </div>
                    <div>
                      <span
                        className={`${styles.status} ${
                          o.status === "PAID" ? styles.statusPaid : ""
                        }`}
                      >
                        {localizeStatus(o.status)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.row} style={{ marginTop: 8 }}>
                    <div className={styles.orderMeta}>
                      수령인: {o.recipientName} / {o.phone}
                    </div>
                    <div className={styles.amount}>
                      {o.total.toLocaleString()}원
                    </div>
                  </div>
                  {o.items?.length ? (
                    <div className={styles.items}>
                      품목: {o.items[0].name}
                      {o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}
                    </div>
                  ) : null}
                  <div className={styles.row} style={{ marginTop: 8 }}>
                    <Link href={`/order/success?oid=${o.orderId}`}>
                      상세보기
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={pageData.first}
              onClick={() => goPage(Math.max(0, page - 1))}
            >
              이전
            </button>
            <span className={styles.pageInfo}>
              {page + 1} / {pageData.totalPages} 페이지 (총{" "}
              {pageData.totalElements.toLocaleString()}건)
            </span>
            <button
              className={styles.pageBtn}
              disabled={pageData.last}
              onClick={() => goPage(page + 1)}
            >
              다음
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageInner />
    </Suspense>
  );
}
