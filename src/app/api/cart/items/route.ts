import { NextRequest, NextResponse } from "next/server";

// 백엔드 장바구니 아이템 엔드포인트(/api/cart/items)로 프록시
// 지원 메서드: GET(목록), POST(없으면 추가 / 있으면 수량 upsert), PATCH(수량 변경), DELETE(삭제)
// 인증 흐름: works 라우트와 동일 - serverToken을 Authorization 헤더로, refreshToken으로 갱신 시도

function getBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

function authHeaders(req: NextRequest, token: string, refreshCookie?: string) {
  const h = new Headers();
  h.set("Authorization", `Bearer ${token}`);
  const forward = ["content-type", "accept", "accept-language", "user-agent"];
  for (const k of forward) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  if (refreshCookie) h.set("cookie", `refreshToken=${refreshCookie}`);
  return h;
}

function passThroughResponse(r: Response) {
  // 응답 Body 는 스트리밍 그대로 전달, 허용된 안전한 헤더만 선별 복사
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

type RefreshPayload = {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [k: string]: unknown;
};

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

async function handleWithAuth(
  req: NextRequest,
  method: string,
  base: string,
  refreshAllowed: boolean
) {
  const cookieHeader = req.headers.get("cookie") || "";
  const refreshCookie = (() => {
    const m = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  })();
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value;

  if (!serverToken && !refreshCookie) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const target = `${base}/api/cart/items`;
  const bodyNeeded = method !== "GET" ? await req.arrayBuffer() : undefined;

  // 1차 호출 (현재 토큰 사용)
  let r = await fetch(target, {
    method,
    headers: authHeaders(req, serverToken || "", refreshCookie),
    cache: "no-store",
    body: bodyNeeded && bodyNeeded.byteLength ? bodyNeeded : undefined,
    signal: req.signal,
    // @ts-expect-error Node fetch 확장 옵션(duplex) 사용
    duplex: method === "GET" ? undefined : "half",
  });

  if (r.status !== 401 || !refreshAllowed || !refreshCookie) {
    return passThroughResponse(r);
  }

  // 401 + refreshToken 존재 시 토큰 갱신 시도
  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (newToken) {
    r = await fetch(target, {
      method,
      headers: authHeaders(req, newToken, refreshCookie),
      cache: "no-store",
      body: bodyNeeded && bodyNeeded.byteLength ? bodyNeeded : undefined,
      signal: req.signal,
      // @ts-expect-error Node fetch 확장 옵션(duplex) 사용
      duplex: method === "GET" ? undefined : "half",
    });

    // refresh 성공 시 갱신된 쿠키를 함께 반환
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

  return passThroughResponse(r);
}

export async function GET(req: NextRequest) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  try {
    return await handleWithAuth(req, "GET", base, true);
  } catch {
    return NextResponse.json({ error: "cart fetch failed" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  try {
    return await handleWithAuth(req, "POST", base, true);
  } catch {
    return NextResponse.json({ error: "cart add failed" }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  try {
    return await handleWithAuth(req, "PATCH", base, true);
  } catch {
    return NextResponse.json({ error: "cart update failed" }, { status: 502 });
  }
}

// DELETE 는 path param 버전 (/api/cart/items/:itemId) 사용으로 변경
export async function DELETE() {
  return NextResponse.json(
    { error: "Use /api/cart/items/{itemId} for delete" },
    { status: 405 }
  );
}
