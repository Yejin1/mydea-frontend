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

async function proxyDirectOrder(req: NextRequest) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");

  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;
  if (!serverToken && !refreshCookie) return errorJson(401, "Unauthorized");

  const target = `${base}/api/orders/direct`;
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

export function POST(req: NextRequest) {
  return proxyDirectOrder(req);
}

export function GET() {
  return errorJson(405, "Method Not Allowed");
}

export function PUT() {
  return errorJson(405, "Method Not Allowed");
}

export function DELETE() {
  return errorJson(405, "Method Not Allowed");
}

export function PATCH() {
  return errorJson(405, "Method Not Allowed");
}

export function OPTIONS() {
  return errorJson(405, "Method Not Allowed");
}
