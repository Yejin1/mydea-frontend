import { NextRequest, NextResponse } from "next/server";

// DELETE /api/cart/items/:itemId 프록시 (백엔드 계약: DELETE /cart/items/{itemId})
// 개별 아이템 삭제만 담당. 다른 메서드는 405 반환.

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

export async function DELETE(req: NextRequest) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  // 동적 세그먼트 itemId를 경로에서 직접 추출 (타입 이슈 회피)
  const pathname = new URL(req.url).pathname;
  const itemId = pathname.split("/").pop() || "";
  if (!itemId || !/^\d+$/.test(itemId)) {
    return NextResponse.json({ error: "invalid itemId" }, { status: 400 });
  }

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

  const target = `${base}/api/cart/items/${itemId}`;
  let r = await fetch(target, {
    method: "DELETE",
    headers: authHeaders(req, serverToken || "", refreshCookie),
    cache: "no-store",
    signal: req.signal,
  });
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);

  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);

  r = await fetch(target, {
    method: "DELETE",
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

// 다른 메서드는 정의하지 않아 405 기본 처리(Next.js 기본 동작) 또는 필요시 별도 구현
