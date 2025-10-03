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

async function proxyOrders(req: NextRequest) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");
  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;
  if (!serverToken && !refreshCookie) return errorJson(401, "Unauthorized");

  const url = new URL(req.url);
  const isList = req.method === "GET";
  const target = `${base}/api/orders${isList ? url.search : ""}`;
  const needBody = req.method === "POST";
  const rawBody = needBody ? await req.arrayBuffer() : undefined;

  let r: Response;
  try {
    r = await fetch(target, {
      method: req.method,
      headers: authHeaders(req, serverToken || "", refreshCookie, [
        "content-type",
        "idempotency-key",
      ]),
      cache: "no-store",
      body: needBody && rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error: node fetch experimental duplex option
      duplex: needBody ? "half" : undefined,
    });
  } catch {
    return errorJson(502, "upstream request failed");
  }
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);

  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);
  try {
    r = await fetch(target, {
      method: req.method,
      headers: authHeaders(req, newToken, refreshCookie, [
        "content-type",
        "idempotency-key",
      ]),
      cache: "no-store",
      body: needBody && rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error: node fetch experimental duplex option
      duplex: needBody ? "half" : undefined,
    });
  } catch {
    return errorJson(502, "upstream request (after refresh) failed");
  }
  const out = passThroughResponse(r);
  applyRefreshedCookies(out, payload, newToken);
  return out;
}

export function GET(req: NextRequest) {
  return proxyOrders(req);
}
export function POST(req: NextRequest) {
  return proxyOrders(req);
}
