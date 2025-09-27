import { NextRequest, NextResponse } from "next/server";

// ---- Types --------------------------------------------------------------
interface RefreshPayload {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [k: string]: unknown;
}

// ---- Helpers ------------------------------------------------------------
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

function pickToken(req: Request, cookieHeader: string): string | undefined {
  const fromAuth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (fromAuth) return fromAuth;
  const m = cookieHeader.match(/(?:^|;\s*)serverToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function backendHeaders(req: Request, token: string, refreshCookie?: string) {
  const h = new Headers();
  if (token) h.set("Authorization", `Bearer ${token}`);
  const pass = ["content-type", "accept", "accept-language", "user-agent"];
  for (const k of pass) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  if (refreshCookie) h.set("cookie", `refreshToken=${refreshCookie}`);
  return h;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function passThrough(r: Response) {
  const ct = r.headers.get("content-type") || "application/json";
  return new NextResponse(r.body, {
    status: r.status,
    headers: { "content-type": ct },
  });
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

async function tryRefresh(
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
  const parsed = await safeJson(res);
  const payload: RefreshPayload = {};
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

async function handle(
  req: NextRequest,
  params: { id: string },
  method: "GET" | "PUT"
) {
  const base = getBase();
  if (!base) return errorJson(500, "API base not configured");
  const { id } = params;
  if (!id || !/^[0-9]+$/.test(id)) return errorJson(400, "invalid id");
  const cookieHeader = req.headers.get("cookie") || "";
  const refreshCookie = extractRefreshCookie(cookieHeader);
  const token = pickToken(req, cookieHeader);
  if (!token && !refreshCookie)
    return new NextResponse("Unauthorized", { status: 401 });

  const target = `${base}/api/works/${id}`;
  const body = method === "PUT" ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      cache: "no-store",
      headers: backendHeaders(req, token || "", refreshCookie),
      body: body && body.byteLength ? body : undefined,
    });
  } catch {
    return errorJson(502, "upstream fetch failed");
  }
  if (upstream.status !== 401 || !refreshCookie) return passThrough(upstream);

  const payload = await tryRefresh(base, refreshCookie);
  const newAccess = payload?.serverToken || payload?.accessToken;
  if (!newAccess) return passThrough(upstream);

  try {
    upstream = await fetch(target, {
      method,
      cache: "no-store",
      headers: backendHeaders(req, newAccess, refreshCookie),
      body: body && body.byteLength ? body : undefined,
    });
  } catch {
    return errorJson(502, "upstream fetch after refresh failed");
  }
  return attachCookies(passThrough(upstream), payload);
}

export function GET(req: NextRequest, ctx: unknown) {
  const id =
    ctx && typeof ctx === "object" && "params" in ctx
      ? (ctx as { params?: { id?: unknown } }).params?.id
      : undefined;
  return handle(req, { id: String(id ?? "") }, "GET");
}

export function PUT(req: NextRequest, ctx: unknown) {
  const id =
    ctx && typeof ctx === "object" && "params" in ctx
      ? (ctx as { params?: { id?: unknown } }).params?.id
      : undefined;
  return handle(req, { id: String(id ?? "") }, "PUT");
}
