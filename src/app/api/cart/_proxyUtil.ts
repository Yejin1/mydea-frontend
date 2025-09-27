import { NextRequest, NextResponse } from "next/server";

// Shared utility functions for cart proxy routes (items & single item)
// Focus: token forwarding, refresh logic, safe header pass-through

export interface RefreshPayload {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [k: string]: unknown; // forward-compat
}

export function getBase(): string | null {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function extractRefreshCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return undefined;
  const m = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

export function authHeaders(
  req: NextRequest,
  token: string,
  refreshCookie?: string,
  extraForward: string[] = []
) {
  const h = new Headers();
  if (token) h.set("Authorization", `Bearer ${token}`);
  const forward = new Set(
    ["accept", "accept-language", "user-agent", ...extraForward].map((v) =>
      v.toLowerCase()
    )
  );
  req.headers.forEach((v, k) => {
    if (forward.has(k.toLowerCase())) h.set(k, v);
  });
  if (refreshCookie) h.set("cookie", `refreshToken=${refreshCookie}`);
  return h;
}

export async function tryRefresh(
  base: string,
  refreshCookie: string
): Promise<{ token: string | null; payload: RefreshPayload | null }> {
  const rr = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `refreshToken=${refreshCookie}`,
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  if (!rr.ok) return { token: null, payload: null };
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

export function passThroughResponse(r: Response) {
  const allowed = new Set([
    "content-type",
    "cache-control",
    "etag",
    "vary",
    "content-length",
  ]);
  const headers = new Headers();
  r.headers.forEach((v, k) => {
    if (allowed.has(k.toLowerCase())) headers.set(k, v);
  });
  return new NextResponse(r.body, { status: r.status, headers });
}

export function applyRefreshedCookies(
  out: NextResponse,
  payload: RefreshPayload | null,
  newToken: string | null
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
  if (newToken) {
    out.cookies.set("serverToken", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });
  }
}

export function errorJson(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}
