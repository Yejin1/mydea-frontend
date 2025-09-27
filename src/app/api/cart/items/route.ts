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

async function proxyItems(req: NextRequest, method: string) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");

  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;
  if (!serverToken && !refreshCookie) return errorJson(401, "Unauthorized");

  const target = `${base}/api/cart/items`;
  const needBody = method !== "GET";
  const rawBody = needBody ? await req.arrayBuffer() : undefined;

  let r: Response;
  try {
    r = await fetch(target, {
      method,
      headers: authHeaders(req, serverToken || "", refreshCookie, [
        "content-type",
      ]),
      cache: "no-store",
      body: rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error Node fetch extension
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
      method,
      headers: authHeaders(req, newToken, refreshCookie, ["content-type"]),
      cache: "no-store",
      body: rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error Node fetch extension
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
  return proxyItems(req, "GET");
}
export function POST(req: NextRequest) {
  return proxyItems(req, "POST");
}
export function PATCH(req: NextRequest) {
  return proxyItems(req, "PATCH");
}
export function DELETE() {
  return errorJson(405, "Use /api/cart/items/{itemId} for delete");
}
