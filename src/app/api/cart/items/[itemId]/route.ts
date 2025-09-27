import { NextRequest, NextResponse } from "next/server";
import {
  getBase,
  extractRefreshCookie,
  authHeaders,
  tryRefresh,
  passThroughResponse,
  applyRefreshedCookies,
  errorJson,
} from "@/app/api/cart/_proxyUtil";

export async function DELETE(req: NextRequest) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");

  const pathname = new URL(req.url).pathname;
  const itemId = pathname.split("/").pop() || "";
  if (!/^\d+$/.test(itemId)) return errorJson(400, "invalid itemId");

  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;
  if (!serverToken && !refreshCookie)
    return new NextResponse("Unauthorized", { status: 401 });

  const target = `${base}/api/cart/items/${itemId}`;
  let r: Response;
  try {
    r = await fetch(target, {
      method: "DELETE",
      headers: authHeaders(req, serverToken || "", refreshCookie),
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return errorJson(502, "upstream delete failed");
  }
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);

  // token refresh 경로
  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);

  try {
    r = await fetch(target, {
      method: "DELETE",
      headers: authHeaders(req, newToken, refreshCookie),
      cache: "no-store",
      signal: req.signal,
    });
  } catch {
    return errorJson(502, "upstream delete (after refresh) failed");
  }
  const out = passThroughResponse(r);
  applyRefreshedCookies(out, payload, newToken);
  return out;
}

export function GET() {
  return errorJson(405, "Method Not Allowed");
}
export const POST = GET;
export const PATCH = GET;
