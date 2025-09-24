// src/app/api/works/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

function backendHeaders(
  req: NextRequest,
  access: string,
  extra?: Record<string, string>
) {
  const h = new Headers();

  // 인증
  h.set("Authorization", `Bearer ${access}`);

  // 원 요청의 의미 있는 헤더만 선별적으로 전달
  const passThroughKeys = [
    "content-type",
    "accept",
    "accept-language",
    "user-agent",
  ];
  for (const k of passThroughKeys) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }

  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

function forwardHeaders(up: Response) {
  // 보안상 set-cookie는 차단, 유용한 응답 헤더만 전달
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
    const key = k.toLowerCase();
    if (allowed.has(key)) out.set(key, v);
  });
  return out;
}

async function forward(upstream: Response) {
  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, {
      status: upstream.status,
      headers: forwardHeaders(upstream),
    });
  }
  // 스트리밍 그대로 전달 (텍스트로 변환하지 않음)
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: forwardHeaders(upstream),
  });
}

type RefreshPayload = {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [key: string]: unknown;
};

// GET /api/works?...
export async function GET(req: NextRequest) {
  const base = getBase();
  // 로그인 시 저장되는 서버측 토큰 이름과 정합성 유지
  const access =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("access_token")?.value ||
    req.cookies.get("accessToken")?.value;
  // 필요한 경우에만 refreshToken 쿠키만 선별 전달 (백엔드가 쿠키 기반 리프레시를 지원할 때)
  const refreshCookie = req.cookies.get("refreshToken")?.value;

  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  if (!access) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[api/works] 401: no access cookie", {
        hasServerToken: !!req.cookies.get("serverToken"),
        hasAccessToken: !!req.cookies.get("accessToken"),
        hasAccess_Underscore: !!req.cookies.get("access_token"),
      });
    }
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const target = `${base}/api/works${url.search}`;
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/works] GET → backend", {
        target,
        tokenLen: access.length,
        tokenPreview: access.slice(0, 10) + "…",
      });
    }

    let r = await fetch(target, {
      method: "GET",
      cache: "no-store",
      headers: (() => {
        const h = backendHeaders(req, access);
        if (refreshCookie) h.set("cookie", `refreshToken=${refreshCookie}`);
        return h;
      })(),
      signal: req.signal,
    });

    // 401이면 서버에서 한 번만 리프레시 시도 후 재시도
    if (r.status === 401) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[api/works] backend 401 — trying refresh");
      }
      const refreshRes = await fetch(`${base}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // 리프레시에 필요한 쿠키만 전달
          ...(refreshCookie ? { cookie: `refreshToken=${refreshCookie}` } : {}),
        },
        body: JSON.stringify({}),
        cache: "no-store",
        signal: req.signal,
      });

      if (refreshRes.ok) {
        const payload: RefreshPayload = {};
        try {
          const parsed: unknown = (await refreshRes.json()) as unknown;
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
        const newAccess = payload?.serverToken || payload?.accessToken;
        if (newAccess) {
          // 새 토큰으로 재시도
          r = await fetch(target, {
            method: "GET",
            cache: "no-store",
            headers: (() => {
              const h = backendHeaders(req, newAccess);
              if (refreshCookie)
                h.set("cookie", `refreshToken=${refreshCookie}`);
              return h;
            })(),
            signal: req.signal,
          });

          // 재시도 결과를 클라이언트에 전달하면서, 우리 도메인의 httpOnly 쿠키도 갱신
          const headersOut = forwardHeaders(r);
          const out = new NextResponse(r.body, {
            status: r.status,
            headers: headersOut,
          });
          // 쿠키 갱신: refreshToken, serverToken
          if (payload?.refreshToken) {
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

          if (process.env.NODE_ENV !== "production") {
            console.log("[api/works] GET ← backend (after refresh)", {
              status: r.status,
              contentType: r.headers.get("content-type"),
            });
          }
          return out;
        }
      }
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[api/works] GET ← backend", {
        status: r.status,
        contentType: r.headers.get("content-type"),
      });
    }
    return forward(r);
  } catch {
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502 }
    );
  }
}

// POST /api/works
export async function POST(req: NextRequest) {
  const base = getBase();
  const access =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("access_token")?.value ||
    req.cookies.get("accessToken")?.value;

  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  if (!access) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await req.arrayBuffer(); // 바이너리/JSON 모두 안전
    const r = await fetch(`${base}/api/works`, {
      method: "POST",
      cache: "no-store",
      headers: backendHeaders(req, access),
      body: body.byteLength ? body : undefined,
      signal: req.signal,
      // Node(undici)에서 바디 스트리밍 옵션이 필요할 경우:
      // @ts-expect-error — Node fetch 확장 옵션
      duplex: "half",
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[api/works] POST → backend", {
        status: r.status,
        contentType: r.headers.get("content-type"),
      });
    }
    return forward(r);
  } catch {
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502 }
    );
  }
}

// DELETE /api/works
export async function DELETE(req: NextRequest) {
  const base = getBase();
  const access =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("access_token")?.value ||
    req.cookies.get("accessToken")?.value;

  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  if (!access) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await req.arrayBuffer();
    const r = await fetch(`${base}/api/works`, {
      method: "DELETE",
      cache: "no-store",
      headers: backendHeaders(req, access),
      body: body.byteLength ? body : undefined,
      signal: req.signal,
      // @ts-expect-error — Node fetch 확장 옵션
      duplex: "half",
    });
    return forward(r);
  } catch {
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502 }
    );
  }
}
