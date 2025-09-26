import { NextRequest, NextResponse } from "next/server";

// 장바구니 전체 조회용 프록시 (/api/cart) - 응답은 { items: [...], total: number }
// 아이템 개별 조작(추가/수정/삭제)은 기존 /api/cart/items 경로 유지

function getBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

type RefreshPayload = {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [k: string]: unknown;
};

function authHeaders(req: NextRequest, token: string, refreshCookie?: string) {
  const h = new Headers();
  h.set("Authorization", `Bearer ${token}`);
  const forward = ["accept", "accept-language", "user-agent"];
  for (const k of forward) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  if (refreshCookie) h.set("cookie", `refreshToken=${refreshCookie}`);
  return h;
}

async function tryRefresh(base: string, refreshCookie: string) {
  const rr = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `refreshToken=${refreshCookie}`,
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!rr.ok)
    return {
      token: null as string | null,
      payload: null as RefreshPayload | null,
    };
  const payload: RefreshPayload = {};
  try {
    const parsed: unknown = await rr.json();
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const rt = obj["refreshToken"];
      const at = obj["accessToken"];
      const st = obj["serverToken"];
      if (typeof rt === "string") payload.refreshToken = rt;
      if (typeof at === "string") payload.accessToken = at;
      if (typeof st === "string") payload.serverToken = st;
      for (const [k, v] of Object.entries(obj))
        if (!(k in payload)) payload[k] = v;
    }
  } catch {}
  const newToken = payload.serverToken || payload.accessToken || null;
  return { token: newToken, payload };
}

function passThroughResponse(r: Response) {
  const allowed = new Set([
    "content-type",
    "cache-control",
    "etag",
    "vary",
    "content-length",
  ]);
  const headers = new Headers();
  r.headers.forEach((v, k) => {
    const key = k.toLowerCase();
    if (allowed.has(key)) headers.set(key, v);
  });
  return new NextResponse(r.body, { status: r.status, headers });
}

async function fetchWithAuth(req: NextRequest, base: string) {
  const cookieHeader = req.headers.get("cookie") || "";
  const refreshCookie = (() => {
    const m = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  })();
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;
  if (!serverToken && !refreshCookie)
    return new NextResponse("Unauthorized", { status: 401 });

  const target = `${base}/api/cart`; // 백엔드 신규 계약
  let r = await fetch(target, {
    method: "GET",
    headers: authHeaders(req, serverToken || "", refreshCookie),
    cache: "no-store",
    signal: req.signal,
  });
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);

  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);

  r = await fetch(target, {
    method: "GET",
    headers: authHeaders(req, newToken, refreshCookie),
    cache: "no-store",
    signal: req.signal,
  });
  const out = passThroughResponse(r);
  if (payload?.refreshToken) {
    out.cookies.set("refreshToken", payload.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
  }
  if (newToken) {
    out.cookies.set("serverToken", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  try {
    return await fetchWithAuth(req, base);
  } catch {
    return NextResponse.json({ error: "cart fetch failed" }, { status: 502 });
  }
}
