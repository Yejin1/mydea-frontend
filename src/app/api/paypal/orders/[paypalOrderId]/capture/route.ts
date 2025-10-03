import { NextRequest } from "next/server";
import {
  getBase,
  extractRefreshCookie,
  authHeaders,
  tryRefresh,
  passThroughResponse,
  applyRefreshedCookies,
  errorJson,
} from "@/app/api/cart/_proxyUtil";

// POST /api/paypal/orders/:paypalOrderId/capture
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paypalOrderId?: string | string[] }> }
) {
  const p = await params;
  const rawId = Array.isArray(p.paypalOrderId)
    ? p.paypalOrderId[0]
    : p.paypalOrderId;
  if (!rawId) return errorJson(400, "paypalOrderId 누락");
  const base = getBase();
  if (!base) return errorJson(500, "백엔드 BASE URL 미설정");
  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken = req.cookies.get("serverToken")?.value || "";
  const target = `${base}/api/paypal/orders/${encodeURIComponent(
    rawId
  )}/capture`;
  const headers = authHeaders(req, serverToken, refreshCookie, [
    "content-type",
  ]);
  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: await req.text(),
    cache: "no-store",
  });
  if (upstream.status === 401 && refreshCookie) {
    const { token, payload } = await tryRefresh(base, refreshCookie);
    if (token) {
      const h2 = authHeaders(req, token, refreshCookie, ["content-type"]);
      const retry = await fetch(target, {
        method: "POST",
        headers: h2,
        body: await req.text(),
        cache: "no-store",
      });
      const out = passThroughResponse(retry);
      applyRefreshedCookies(out, payload, token);
      return out;
    }
  }
  return passThroughResponse(upstream);
}
