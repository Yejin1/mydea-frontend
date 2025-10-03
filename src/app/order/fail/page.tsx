"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function FailInner() {
  const search = useSearchParams();
  const message = search.get("message") || "결제가 실패했습니다.";
  const code = search.get("code");
  const pgOrderId = search.get("orderId");
  let derivedId: string | null = null;
  if (pgOrderId && pgOrderId.startsWith("ORDER-"))
    derivedId = pgOrderId.substring(6);
  return (
    <div style={{ padding: 40 }}>
      <h1>결제 실패</h1>
      <p style={{ color: "red" }}>{message}</p>
      {code && <p>코드: {code}</p>}
      {derivedId && /^\d+$/.test(derivedId) && (
        <p style={{ fontSize: 12, color: "#666" }}>
          주문 ID (추정): {derivedId}
        </p>
      )}
      <a
        href="/order"
        style={{ color: "#3182f6", textDecoration: "underline" }}
      >
        다시 시도
      </a>
    </div>
  );
}

export default function OrderFailPage() {
  return (
    <Suspense>
      <FailInner />
    </Suspense>
  );
}
