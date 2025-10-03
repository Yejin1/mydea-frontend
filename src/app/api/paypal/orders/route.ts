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

// POST /api/paypal/orders?ref=...&currency=USD&amount=1000 (KRW는 지원안함)
export async function POST(req: NextRequest) {
  const base = getBase();
  if (!base) return errorJson(500, "백엔드 BASE URL 미설정");
  const url = new URL(req.url);
  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken = req.cookies.get("serverToken")?.value || "";
  const target = `${base}/api/paypal/orders${url.search}`;
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
