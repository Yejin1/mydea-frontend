import { NextResponse } from "next/server";

function getBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

async function forward(r: Response) {
  if (r.status === 204 || r.status === 304) {
    return new NextResponse(null, { status: r.status });
  }
  const contentType = r.headers.get("content-type") || "application/json";
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": contentType },
  });
}

function backendHeaders(req: Request, access: string, refreshCookie?: string) {
  const h = new Headers();
  h.set("Authorization", `Bearer ${access}`);
  const passThrough = [
    "content-type",
    "accept",
    "accept-language",
    "user-agent",
  ];
  for (const k of passThrough) {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  }
  if (refreshCookie) h.set("cookie", `refreshToken=${refreshCookie}`);
  return h;
}

type RefreshPayload = {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  [key: string]: unknown;
};

function buildOutWithCookies(r: Response, payload?: RefreshPayload) {
  const contentType = r.headers.get("content-type") || "application/json";
  const out = new NextResponse(r.body, {
    status: r.status,
    headers: { "content-type": contentType },
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  const body = await req.text();
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
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const target = `${base}/api/works/${id}/preview-url`;
  let r = await fetch(target, {
    method: "PATCH",
    headers: backendHeaders(req, token || "", refreshCookie),
    body,
  });

  if (r.status !== 401 && token) return forward(r);

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
      const payload: RefreshPayload = {};
      try {
        const parsed: unknown = (await rr.json()) as unknown;
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
        r = await fetch(target, {
          method: "PATCH",
          headers: backendHeaders(req, newAccess, refreshCookie),
          body,
        });
        return buildOutWithCookies(r, payload);
      }
    }
  }
  return forward(r);
}
