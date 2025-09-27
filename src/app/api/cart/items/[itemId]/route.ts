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

async function proxyItem(req: NextRequest, method: "DELETE" | "PATCH") {
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
  // PATCH 인 경우 body 전달 필요 (예: { quantity: number })
  const needBody = method === "PATCH";
  const rawBody = needBody ? await req.arrayBuffer() : undefined;
  let r: Response;
  try {
    r = await fetch(target, {
      method,
      headers: authHeaders(
        req,
        serverToken || "",
        refreshCookie,
        [needBody ? "content-type" : undefined].filter(Boolean) as string[]
      ),
      cache: "no-store",
      body: rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error Node fetch extension
      duplex: needBody ? "half" : undefined,
    });
  } catch {
    return errorJson(
      502,
      method === "DELETE" ? "upstream delete failed" : "upstream patch failed"
    );
  }
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);

  // token refresh 경로
  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);

  try {
    r = await fetch(target, {
      method,
      headers: authHeaders(
        req,
        newToken,
        refreshCookie,
        [needBody ? "content-type" : undefined].filter(Boolean) as string[]
      ),
      cache: "no-store",
      body: rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error Node fetch extension
      duplex: needBody ? "half" : undefined,
    });
  } catch {
    return errorJson(
      502,
      method === "DELETE"
        ? "upstream delete (after refresh) failed"
        : "upstream patch (after refresh) failed"
    );
  }
  const out = passThroughResponse(r);
  applyRefreshedCookies(out, payload, newToken);
  return out;
}

export async function DELETE(req: NextRequest) {
  return proxyItem(req, "DELETE");
}

export async function PATCH(req: NextRequest) {
  return proxyItem(req, "PATCH");
}

export function GET() {
  return errorJson(405, "Method Not Allowed");
}
// GET/POST 는 허용하지 않음 (목록/생성은 /api/cart/items 사용)
export const POST = GET;
