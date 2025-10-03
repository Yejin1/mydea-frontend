"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./success.module.css";

interface OrderItem {
  orderItemId: number;
  workId: number;
  name: string;
  optionHash: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  thumbUrl?: string | null;
}
interface OrderDetail {
  orderId: number;
  orderNo: string;
  status: string;
  total: number;
  items?: OrderItem[];
}

function SuccessInner() {
  const search = useSearchParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pgOrderId = search.get("orderId");
    const explicitOid = search.get("oid");
    let numericId: number | null = null;
    if (explicitOid && /^\d+$/.test(explicitOid))
      numericId = Number(explicitOid);
    else if (pgOrderId && pgOrderId.startsWith("ORDER-")) {
      const tail = pgOrderId.substring(6);
      if (/^\d+$/.test(tail)) numericId = Number(tail);
    }
    if (numericId == null) {
      setError("주문 식별자를 파싱할 수 없습니다.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${numericId}`);
        if (!res.ok) throw new Error(`주문 조회 실패 (${res.status})`);
        const data = await res.json();
        if (!cancelled) setOrder(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "주문 조회 오류");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search]);

  if (loading)
    return (
      <div className={styles.container}>
        <div className={styles.loadingText}>주문 정보를 불러오는 중...</div>
      </div>
    );
  if (error)
    return (
      <div className={styles.container}>
        <h1>주문 완료</h1>
        <p className={styles.error}>{error}</p>
      </div>
    );
  if (!order)
    return (
      <div className={styles.container}>
        <div className={styles.emptyText}>주문 정보 없음</div>
      </div>
    );
  const statusNote =
    order.status === "PAID"
      ? "결제가 완료되었습니다."
      : `주문 상태: ${order.status}`;
  return (
    <div className={styles.container}>
      <h1>주문 완료 🎉</h1>
      <p>
        <strong>주문번호:</strong> {order.orderNo} (ID: {order.orderId})
      </p>
      <p>
        <strong>총액:</strong> {order.total.toLocaleString()}원
      </p>
      <p
        className={order.status === "PAID" ? styles.statusPaid : styles.status}
      >
        {statusNote}
      </p>
      {order.items?.length ? (
        <ul className={styles.itemsList}>
          {order.items.map((it) => (
            <li key={it.orderItemId} className={styles.item}>
              {it.name} x{it.quantity}
              <span className={styles.itemAmount}>
                {it.lineTotal.toLocaleString()}원
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.links}>
        <Link href="/" className={styles.link}>
          메인
        </Link>
        <Link href="/order" className={styles.link}>
          추가 주문
        </Link>
        <Link href="/myworks" className={styles.link}>
          내 작품
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense>
      <SuccessInner />
    </Suspense>
  );
}
