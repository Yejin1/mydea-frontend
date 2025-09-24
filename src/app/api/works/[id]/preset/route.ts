import { NextResponse } from "next/server";

function getBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

function backendHeaders(req: Request, access: string, refreshCookie?: string) {
  const h = new Headers();
  h.set("Authorization", `Bearer ${access}`);
  const pass = ["accept", "accept-language", "user-agent"];
  for (const k of pass) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  if (refreshCookie) h.set("cookie", `refreshToken=${refreshCookie}`);
  return h;
}

function buildOutWithCookies(r: Response, payload?: any) {
  const ct = r.headers.get("content-type") || "application/json";
  const out = new NextResponse(r.body, {
    status: r.status,
    headers: { "content-type": ct },
  });
  const newAccess = payload?.serverToken || payload?.accessToken;
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
  return out;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  const { id } = await params;

  const cookieHeader = req.headers.get("cookie") || "";
  const refreshCookie = (() => {
    const m = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  })();
  const accessFromAuth = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const accessFromCookie = (() => {
    const m = cookieHeader.match(/(?:^|;\s*)serverToken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  })();
  const token = accessFromAuth || accessFromCookie;

  if (!token && !refreshCookie) {
    // preset은 비로그인 사용자도 접근 가능하게 하려면 여길 permitAll로 바꾸고, 백엔드도 공개 허용 필요
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const target = `${base}/api/works/${id}/preset`;
  let r = await fetch(target, {
    cache: "no-store",
    headers: backendHeaders(req, token || "", refreshCookie),
  });

  if (r.status !== 401 && token) return r;

  if (refreshCookie) {
    const rr = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `refreshToken=${refreshCookie}`,
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (rr.ok) {
      let payload: any = {};
      try {
        payload = await rr.json();
      } catch {}
      const newAccess = payload?.serverToken || payload?.accessToken;
      if (newAccess) {
        r = await fetch(target, {
          cache: "no-store",
          headers: backendHeaders(req, newAccess, refreshCookie),
        });
        return buildOutWithCookies(r, payload);
      }
    }
  }
  return r;
}
