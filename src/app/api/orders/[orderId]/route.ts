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

async function proxyOrderDetail(req: NextRequest, orderId: string) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");
  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;
  if (!serverToken && !refreshCookie) return errorJson(401, "Unauthorized");
  const target = `${base}/api/orders/${orderId}`;
  let r: Response;
  try {
    r = await fetch(target, {
      method: "GET",
      headers: authHeaders(req, serverToken || "", refreshCookie),
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return errorJson(502, "upstream request failed");
  }
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);
  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);
  try {
    r = await fetch(target, {
      method: "GET",
      headers: authHeaders(req, newToken, refreshCookie),
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return errorJson(502, "upstream request (after refresh) failed");
  }
  const out = passThroughResponse(r);
  applyRefreshedCookies(out, payload, newToken);
  return out;
}

export const GET = async (
  req: NextRequest,
  context: { params: Promise<{ orderId?: string | string[] }> }
) => {
  const { orderId } = await context.params;
  let id: string | undefined;
  if (Array.isArray(orderId)) id = orderId[0];
  else id = orderId;
  if (!id) return errorJson(400, "orderId missing");
  return proxyOrderDetail(req, id);
};
