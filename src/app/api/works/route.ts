// src/app/api/works/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 참고: 중복되던 리프레시 / 헤더 전달 로직을 제거하기 위해 리팩터링된 파일입니다.
// TODO (향후): `api/works/[id]/route.ts` 와 통합하거나 cart `_proxyUtil.ts` 와 공통 유틸로 병합 검토.

const DEBUG = process.env.NODE_ENV !== "production";

interface RefreshPayload {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [k: string]: unknown;
}

function getBase(): string | null {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

// 여러 이름으로 존재할 수 있는 액세스(서버) 토큰 쿠키 중 우선순위에 따라 선택
function pickAccessToken(req: NextRequest) {
  return (
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("access_token")?.value ||
    req.cookies.get("accessToken")?.value ||
    null
  );
}

// refreshToken 쿠키 추출
function getRefreshCookie(req: NextRequest) {
  return req.cookies.get("refreshToken")?.value;
}

// 백엔드로 전달할 헤더 구성 (선별된 헤더 + Authorization + refreshToken 전달)
function buildHeaders(req: NextRequest, token: string, refresh?: string) {
  const h = new Headers();
  if (token) h.set("Authorization", `Bearer ${token}`);
  const forward = new Set([
    "content-type",
    "accept",
    "accept-language",
    "user-agent",
  ]);
  req.headers.forEach((v, k) => {
    if (forward.has(k.toLowerCase())) h.set(k, v);
  });
  if (refresh) h.set("cookie", `refreshToken=${refresh}`);
  return h;
}

// 업스트림 응답 헤더 중 안전하고 의미 있는 것만 선별 전달
function forwardHeaders(up: Response) {
  const allowed = new Set([
    "content-type",
    "cache-control",
    "etag",
    "vary",
    "content-disposition",
    "content-length",
  ]);
  const out = new Headers();
  up.headers.forEach((v, k) => {
    if (allowed.has(k.toLowerCase())) out.set(k, v);
  });
  return out;
}

// 업스트림 응답을 본문 스트리밍 그대로 전달 (204/304 예외 처리)
function passThrough(up: Response) {
  if (up.status === 204 || up.status === 304) {
    return new NextResponse(null, {
      status: up.status,
      headers: forwardHeaders(up),
    });
  }
  return new NextResponse(up.body, {
    status: up.status,
    headers: forwardHeaders(up),
  });
}

// refresh 시도 (성공 시 새 토큰 및 페이로드 반환, 실패 시 null)
async function tryRefresh(
  base: string,
  refreshCookie?: string
): Promise<{
  token: string | null;
  payload: RefreshPayload | null;
}> {
  if (!refreshCookie) return { token: null, payload: null };
  const r = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `refreshToken=${refreshCookie}`,
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!r.ok) return { token: null, payload: null };
  const payload: RefreshPayload = {};
  try {
    const parsed: unknown = await r.json();
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const rt = obj["refreshToken"];
      if (typeof rt === "string") payload.refreshToken = rt;
      const at = obj["accessToken"];
      if (typeof at === "string") payload.accessToken = at;
      const st = obj["serverToken"];
      if (typeof st === "string") payload.serverToken = st;
      for (const [k, v] of Object.entries(obj))
        if (!(k in payload)) payload[k] = v;
    }
  } catch {}
  const token = payload.serverToken || payload.accessToken || null;
  return { token, payload: token ? payload : null };
}

// 새 refreshToken / serverToken 을 httpOnly 쿠키로 갱신
function applyRefreshedCookies(
  out: NextResponse,
  payload: RefreshPayload | null,
  token: string | null
) {
  if (payload?.refreshToken) {
    out.cookies.set("refreshToken", payload.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
  }
  if (token) {
    out.cookies.set("serverToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
  }
}

// 표준 에러 JSON 응답 형태
function errorJson(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

// 공통 처리: 업스트림 호출 → 401 일회성 refresh 재시도 → 쿠키 갱신 → 응답 패스스루
async function perform(req: NextRequest, method: "GET" | "POST" | "DELETE") {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");
  const token = pickAccessToken(req);
  if (!token) return errorJson(401, "Unauthorized");
  const refresh = getRefreshCookie(req);
  const url = new URL(req.url);
  const target = `${base}/api/works${url.search}`;

  let body: ArrayBuffer | undefined;
  if (method !== "GET") {
    const buf = await req.arrayBuffer();
    body = buf.byteLength ? buf : undefined;
  }

  if (DEBUG) {
    console.log(`[api/works] ${method} → backend`, { target });
  }

  let res = await fetch(target, {
    method,
    cache: "no-store",
    headers: buildHeaders(req, token, refresh),
    body,
    signal: req.signal,
    ...(method !== "GET" ? { duplex: "half" } : {}),
  });

  if (res.status === 401) {
    if (DEBUG) console.warn(`[api/works] ${method} 401 → attempting refresh`);
    const { token: newToken, payload } = await tryRefresh(base, refresh);
    if (newToken) {
      res = await fetch(target, {
        method,
        cache: "no-store",
        headers: buildHeaders(req, newToken, refresh),
        body,
        signal: req.signal,
        ...(method !== "GET" ? { duplex: "half" } : {}),
      });
      const out = passThrough(res);
      applyRefreshedCookies(out, payload, newToken);
      if (DEBUG)
        console.log(`[api/works] ${method} ← backend (after refresh)`, {
          status: res.status,
        });
      return out;
    }
  }

  if (DEBUG) {
    console.log(`[api/works] ${method} ← backend`, { status: res.status });
  }
  return passThrough(res);
}

// GET /api/works
export async function GET(req: NextRequest) {
  try {
    return await perform(req, "GET");
  } catch {
    return errorJson(502, "Upstream fetch failed");
  }
}

// POST /api/works
export async function POST(req: NextRequest) {
  try {
    return await perform(req, "POST");
  } catch {
    return errorJson(502, "Upstream fetch failed");
  }
}

// DELETE /api/works
export async function DELETE(req: NextRequest) {
  try {
    return await perform(req, "DELETE");
  } catch {
    return errorJson(502, "Upstream fetch failed");
  }
}
