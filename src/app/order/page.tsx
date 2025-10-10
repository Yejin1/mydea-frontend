"use client";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getAccessoryTotalPrice,
  Accessory,
  Design,
} from "@/lib/customizerMath";
import styles from "./order.module.css";

// PayPal 관련 타입
interface PaypalButtonsConfig {
  createOrder: () => Promise<string> | string;
  onApprove: (data: OnApproveData) => Promise<void> | void;
  onError?: (err: unknown) => void;
}
interface OnApproveData {
  orderID: string;
  payerID?: string;
}

interface WorkSummaryResponse {
  id: number;
  name: string;
  previewUrl: string | null;
  designType: string;
  workType: string;
}

interface DirectItemPayload {
  workId: number;
  optionHash: string;
  name: string;
  thumbUrl: string | null;
  unitPrice: number;
  quantity: number;
}

interface CartResponseShape {
  cartId?: number;
  id?: number;
  items?: unknown[];
  total?: number;
  [k: string]: unknown;
}

function OrderContentInner() {
  const search = useSearchParams();
  const router = useRouter();
  const workId = search.get("workId");
  const sizeMmParam = search.get("size");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [work, setWork] = useState<WorkSummaryResponse | null>(null);
  // 미리보기 총액: -1이면 아직 계산 전
  const [previewTotal, setPreviewTotal] = useState<number>(-1);
  const [cartId, setCartId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null); // 주문 ID
  const [orderNo, setOrderNo] = useState<string>(""); // 표시용 주문번호
  const [capturing, setCapturing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [recipient, setRecipient] = useState({
    name: "",
    phone: "",
    zipcode: "",
    address1: "",
    address2: "",
    note: "",
  });
  const [directMode, setDirectMode] = useState(false); // true이면 /api/orders/direct 바로주문 모드 사용

  // 바로 주문(single item) payload 구성
  function buildDirectItems(): DirectItemPayload[] {
    if (!work) return [];
    // optionHash: 최소 사이즈 정보/기타 customize 옵션(현재 sizeMmParam만)
    const sizeMm = sizeMmParam ? Number(sizeMmParam) : 0;
    const option: Record<string, unknown> = {};
    if (sizeMm > 0) option.sizeMm = sizeMm;
    let unitPrice = 0;
    try {
      const acc = (work.workType as Accessory) || "ring";
      const design = (work.designType as Design) || "basic";
      if (sizeMm > 0) unitPrice = getAccessoryTotalPrice(acc, sizeMm, design);
      else unitPrice = getAccessoryTotalPrice(acc, 0, design);
    } catch {
      unitPrice = previewTotal || 0;
    }
    return [
      {
        workId: work.id,
        optionHash: JSON.stringify(option),
        name: work.name,
        thumbUrl: work.previewUrl || null,
        unitPrice,
        quantity: 1,
      },
    ];
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (workId) {
          const res = await fetch(`/api/works/${workId}`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setWork(data);
          }
        }
        // 1) 먼저 cart 시도 (로그인/정규 흐름)
        let resolvedCartId: number | undefined;
        try {
          const cartRes = await fetch("/api/cart", { cache: "no-store" });
          if (cartRes.ok) {
            const cartData: CartResponseShape = await cartRes.json();
            if (typeof cartData.cartId === "number")
              resolvedCartId = cartData.cartId;
            else if (typeof cartData.id === "number")
              resolvedCartId = cartData.id;
          }
        } catch {
          // 네트워크 오류/비인증(401) 등은 무시하고 바로주문 fallback 준비
        }
        if (!cancelled && resolvedCartId) setCartId(resolvedCartId);

        // 2) 주문 미리보기: cartId 있으면 기존 preview 호출, 없으면 direct 모드로 전환 (direct는 프론트에서 추정 금액 계산)
        if (resolvedCartId) {
          const previewRes = await fetch("/api/orders/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cartId: resolvedCartId }),
          });
          if (previewRes.ok) {
            const pv = await previewRes.json();
            if (!cancelled && typeof pv?.total === "number")
              setPreviewTotal(pv.total);
          } else {
            const t = await previewRes.text();
            throw new Error(t || "미리보기 실패");
          }
        } else {
          // Direct 모드 활성화: 프론트에서 단가 계산하여 미리보기 표시
          if (!cancelled) setDirectMode(true);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "로드 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workId, sizeMmParam]);

  async function createOrder() {
    if (creating || orderId) return;
    try {
      setCreating(true);
      let res: Response;
      if (directMode) {
        // 바로 주문 생성
        const items = buildDirectItems();
        res = await fetch("/api/orders/direct", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `direct-${workId}-${Date.now()}`,
          },
          body: JSON.stringify({
            items,
            recipientName: recipient.name || "받는이",
            phone: recipient.phone || "010-0000-0000",
            address1: recipient.address1 || "주소1",
            address2: recipient.address2 || null,
            zipcode: recipient.zipcode || "00000",
            note: recipient.note || null,
            ttlSeconds: 600,
          }),
        });
      } else {
        if (!cartId) {
          alert("장바구니 정보를 불러올 수 없습니다.");
          return;
        }
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cartId,
            recipientName: recipient.name || "받는이",
            phone: recipient.phone || "010-0000-0000",
            address1: recipient.address1 || "주소1",
            address2: recipient.address2 || null,
            zipcode: recipient.zipcode || "00000",
            note: recipient.note || null,
          }),
        });
      }
      if (!res.ok) {
        let detail = "";
        try {
          const text = await res.text();
          detail = text;
        } catch {}
        // 400 케이스: 빈 카트 / 단가 불일치 / 필수 필드 검증 실패 등
        if (res.status === 400) {
          throw new Error(
            detail ||
              (directMode
                ? "바로 주문 요청이 유효하지 않습니다. (필수 필드/가격 검증)"
                : "장바구니가 비었거나 주문 요청이 잘못되었습니다.")
          );
        }
        throw new Error(detail || `주문 생성 실패 (${res.status})`);
      }
      const data = await res.json();
      setOrderId(data.orderId);
      setOrderNo(data.orderNo);
      if (directMode && typeof data.total === "number") {
        setPreviewTotal(data.total);
      }
      // PayPal 결제 진행을 위해 주문 생성까지만 수행, 결제 완료 후 success 이동
    } catch (e) {
      alert(e instanceof Error ? e.message : "주문 생성 실패");
    } finally {
      setCreating(false);
    }
  }

  // PayPal SDK 스크립트 로드 & 버튼 렌더
  useEffect(() => {
    if (!orderId) return; // 주문 생성 전에는 버튼 필요 없음
    // 이미 로드되어 있다면 재렌더 시도
    function renderButtons() {
      const w = window as unknown as {
        paypal?: {
          Buttons: (cfg: PaypalButtonsConfig) => {
            render: (sel: string) => Promise<void> | void;
          };
        };
      };
      if (!w.paypal) return;
      const paypal = w.paypal;
      try {
        paypal
          .Buttons({
            createOrder: async (): Promise<string> => {
              // 백엔드 PayPal order 생성 프록시 호출
              const params = new URLSearchParams({
                ref: `MYDEA-${orderId}`,
                currency: "USD",
                amount: String(Math.max(0, previewTotal)),
              });
              const res = await fetch(`/api/paypal/orders?${params}`, {
                method: "POST",
              });
              if (!res.ok) throw new Error("PayPal 주문 생성 실패");
              const data = await res.json();
              // PayPal order id는 별도 상태 저장 생략
              return data.id;
            },
            onApprove: async (data: OnApproveData) => {
              if (!data.orderID) return;
              setCapturing(true);
              try {
                const res = await fetch(
                  `/api/paypal/orders/${data.orderID}/capture`,
                  { method: "POST" }
                );
                if (!res.ok) throw new Error("캡처 실패");
                const cap = await res.json();
                if (cap?.status === "COMPLETED" || cap?.status === "CAPTURED") {
                  router.push(`/order/success?oid=${orderId}`);
                } else {
                  alert(`결제 상태: ${cap?.status || "알 수 없음"}`);
                }
              } catch (e) {
                console.error(e);
                alert("결제 캡처 오류");
              } finally {
                setCapturing(false);
              }
            },
            onError: (err: unknown) => {
              console.error(err as Error);
              alert("PayPal 결제 중 오류");
            },
          })
          .render("#paypal-button-container");
      } catch (e) {
        console.error(e);
      }
    }

    const wGlobal = window as unknown as { paypal?: unknown };
    if (wGlobal.paypal) {
      renderButtons();
      return;
    }
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    console.log("PayPal Client ID:", clientId);
    if (!clientId) return; // 환경 변수 없으면 스킵
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=buttons&currency=USD`;
    script.async = true;
    script.onload = renderButtons;
    document.body.appendChild(script);
    return () => {
      // PayPal SDK는 전역 주입이라 제거는 선택사항 (여기선 noop)
    };
  }, [orderId, previewTotal, router]);

  // PayPal 관련 타입 선언
  // (타입 선언은 파일 상단에 배치됨)

  // Direct 모드일 때 프론트 추정 금액 계산 (work/size 기반)
  useEffect(() => {
    if (!directMode || !work) return;
    try {
      const sizeMm = sizeMmParam ? Number(sizeMmParam) : 0;
      const acc = (work.workType as Accessory) || "ring";
      const design = (work.designType as Design) || "basic";
      const unit = getAccessoryTotalPrice(acc, sizeMm > 0 ? sizeMm : 0, design);
      setPreviewTotal(unit);
    } catch {
      setPreviewTotal(-1);
    }
  }, [directMode, work, sizeMmParam]);

  if (!workId) return <div>workId 파라미터 필요</div>;
  if (loading) return <div>주문 정보 불러오는 중...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!work) return <div>작업을 찾을 수 없습니다.</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>주문 / 결제</h1>
      <div className={styles.layoutRow}>
        {work.previewUrl && (
          <div className={styles.previewThumbWrapper}>
            <Image
              src={work.previewUrl}
              alt="preview"
              fill
              sizes="160px"
              style={{ objectFit: "cover" }}
              priority={false}
            />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <p className={styles.infoP}>
            <strong>이름:</strong> {work.name}
          </p>
          <p className={styles.infoP}>
            <strong>디자인:</strong> {work.designType}
          </p>
          <p className={styles.infoP}>
            <strong>종류:</strong> {work.workType}
          </p>
          <p className={styles.infoP}>
            <strong>사이즈(mm):</strong> {sizeMmParam}
          </p>
          <p className={styles.infoP}>
            <strong>주문 예상 총액:</strong>{" "}
            {previewTotal >= 0 ? previewTotal.toLocaleString() : "--"}원
            {cartId && !directMode && (
              <span className={styles.amountNote}>(cartId: {cartId})</span>
            )}
          </p>
          {orderId && (
            <p className={styles.orderIdInfo}>
              주문ID: {orderId} ({orderNo})
            </p>
          )}
        </div>
      </div>
      {/* PayPal 결제 영역 */}
      <hr className={styles.divider} />
      <div className={styles.recipientForm}>
        <input
          placeholder="받는이"
          value={recipient.name}
          onChange={(e) =>
            setRecipient((r) => ({ ...r, name: e.target.value }))
          }
        />
        <input
          placeholder="전화번호"
          value={recipient.phone}
          onChange={(e) =>
            setRecipient((r) => ({ ...r, phone: e.target.value }))
          }
        />
        <input
          placeholder="우편번호"
          value={recipient.zipcode}
          onChange={(e) =>
            setRecipient((r) => ({ ...r, zipcode: e.target.value }))
          }
        />
        <input
          placeholder="주소1"
          value={recipient.address1}
          onChange={(e) =>
            setRecipient((r) => ({ ...r, address1: e.target.value }))
          }
        />
        <input
          placeholder="주소2"
          value={recipient.address2}
          onChange={(e) =>
            setRecipient((r) => ({ ...r, address2: e.target.value }))
          }
        />
        <input
          placeholder="요청사항"
          value={recipient.note}
          onChange={(e) =>
            setRecipient((r) => ({ ...r, note: e.target.value }))
          }
        />
      </div>
      <button
        disabled={creating || !!orderId}
        onClick={createOrder}
        className={`${styles.primaryBtn} ${
          creating || orderId ? styles.disabled : ""
        }`}
      >
        {orderId
          ? "주문 생성 완료"
          : creating
          ? "주문 생성중..."
          : directMode
          ? "바로 주문 생성"
          : "주문 생성"}
      </button>
      <div style={{ marginTop: 8 }}>
        {orderId ? (
          <>
            <div id="paypal-button-container" />
            {capturing && (
              <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                결제 승인 처리 중...
              </p>
            )}
            <p className={styles.paypalNote}>
              테스트 결제용 카드 번호는 PayPal 샌드박스 문서를 참고하세요:{" "}
              <a
                href="https://developer.paypal.com/tools/sandbox/card-testing"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#3182f6" }}
              >
                카드 테스트 목록
              </a>
            </p>
          </>
        ) : (
          <p style={{ fontSize: 12, color: "#999" }}>
            주문 생성 후 PayPal 버튼이 나타납니다.
          </p>
        )}
      </div>
      <button onClick={() => router.back()} className={styles.backBtn}>
        돌아가기
      </button>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense>
      <OrderContentInner />
    </Suspense>
  );
}
