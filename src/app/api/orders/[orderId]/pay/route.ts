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

async function proxyOrderPay(req: NextRequest, orderId: string) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");
  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;
  if (!serverToken && !refreshCookie) return errorJson(401, "Unauthorized");

  const target = `${base}/api/orders/${orderId}/pay`;
  const rawBody = await req.arrayBuffer();

  let r: Response;
  try {
    r = await fetch(target, {
      method: "POST",
      headers: authHeaders(req, serverToken || "", refreshCookie, [
        "content-type",
        "idempotency-key",
      ]),
      cache: "no-store",
      body: rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error node fetch extension
      duplex: "half",
    });
  } catch {
    return errorJson(502, "upstream request failed");
  }
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);

  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);
  try {
    r = await fetch(target, {
      method: "POST",
      headers: authHeaders(req, newToken, refreshCookie, [
        "content-type",
        "idempotency-key",
      ]),
      cache: "no-store",
      body: rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error node fetch extension
      duplex: "half",
    });
  } catch {
    return errorJson(502, "upstream request (after refresh) failed");
  }
  const out = passThroughResponse(r);
  applyRefreshedCookies(out, payload, newToken);
  return out;
}

export const POST = async (
  req: NextRequest,
  context: { params: Promise<{ orderId?: string | string[] }> }
) => {
  const { orderId } = await context.params;
  let id: string | undefined;
  if (Array.isArray(orderId)) id = orderId[0];
  else id = orderId;
  if (!id) return errorJson(400, "orderId missing");
  return proxyOrderPay(req, id);
};
