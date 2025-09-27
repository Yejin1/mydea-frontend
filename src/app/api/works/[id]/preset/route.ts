import { NextRequest, NextResponse } from "next/server";

// ---- Types --------------------------------------------------------------
interface RefreshPayload {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [k: string]: unknown;
}

// ---- Helpers ------------------------------------------------------------
const ALLOWED_RESP_HEADERS = new Set([
  "content-type",
  "cache-control",
  "etag",
  "vary",
  "content-length",
]);

function getBase(): string | null {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function extractRefreshCookie(header: string | null): string | undefined {
  if (!header) return undefined;
  const m = header.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function pickAccess(req: Request, cookieHeader: string) {
  const fromAuth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (fromAuth) return fromAuth;
  const m = cookieHeader.match(/(?:^|;\s*)serverToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function backendHeaders(req: Request, token: string, refresh?: string) {
  const h = new Headers();
  if (token) h.set("Authorization", `Bearer ${token}`);
  const forward = ["accept", "accept-language", "user-agent"];
  for (const k of forward) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  if (refresh) h.set("cookie", `refreshToken=${refresh}`);
  return h;
}

async function safeJson(res: Response) {
  try {
    return (await res.json()) as unknown;
  } catch {
    return {};
  }
}

function passThrough(r: Response) {
  const headers = new Headers();
  r.headers.forEach((v, k) => {
    if (ALLOWED_RESP_HEADERS.has(k.toLowerCase())) headers.set(k, v);
  });
  return new NextResponse(r.body, { status: r.status, headers });
}

function attachCookies(out: NextResponse, payload?: RefreshPayload) {
  if (!payload) return out;
  const newAccess = payload.serverToken || payload.accessToken;
  if (payload.refreshToken) {
    out.cookies.set("refreshToken", payload.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
  }
  if (newAccess) {
    out.cookies.set("serverToken", newAccess, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
  }
  return out;
}

async function refresh(
  base: string,
  refreshCookie: string
): Promise<RefreshPayload | null> {
  const res = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `refreshToken=${refreshCookie}`,
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const payload: RefreshPayload = {};
  const parsed = await safeJson(res);
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
  return payload;
}

function errorJson(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePreset(req: NextRequest, params: { id: string }) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");
  const { id } = params;
  if (!id || !/^[0-9]+$/.test(id)) return errorJson(400, "invalid id");

  const cookieHeader = req.headers.get("cookie") || "";
  const refreshCookie = extractRefreshCookie(cookieHeader);
  const token = pickAccess(req, cookieHeader);
  // 비로그인 상태에서도 preset 조회를 허용하기 위해 Unauthorized 즉시 반환을 제거
  // (백엔드가 공개 preset 조회를 허용한다고 가정)
  // token/refresh 둘 다 없으면 Authorization 헤더 없이 시도 -> 401 이면 그대로 전달

  const target = `${base}/api/works/${id}/preset`;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      cache: "no-store",
      headers: backendHeaders(req, token || "", refreshCookie),
    });
  } catch {
    return errorJson(502, "upstream fetch failed");
  }
  if (upstream.status !== 401 || !refreshCookie) return passThrough(upstream);

  const payload = await refresh(base, refreshCookie);
  const newAccess = payload?.serverToken || payload?.accessToken;
  if (!newAccess) return passThrough(upstream);

  try {
    upstream = await fetch(target, {
      cache: "no-store",
      headers: backendHeaders(req, newAccess, refreshCookie),
    });
  } catch {
    return errorJson(502, "upstream fetch after refresh failed");
  }
  return attachCookies(passThrough(upstream), payload || undefined);
}

// NOTE: ctx 타입을 넓혀 Next.js 15 타입 생성 충돌을 우회 (TODO: 추후 공식 타입 안정화 후 좁히기)
export async function GET(req: NextRequest, ctx: unknown) {
  const params =
    ctx && typeof ctx === "object" && "params" in ctx
      ? (ctx as { params: { id?: unknown } }).params
      : { id: undefined };
  return handlePreset(req, { id: String(params.id ?? "") });
}
