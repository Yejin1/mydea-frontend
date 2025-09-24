import { NextResponse } from "next/server";

type RefreshResponse = {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
  // allow any other fields while keeping strong typing for the ones we use
  [key: string]: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

export async function POST(req: Request) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );

  try {
    const cookie = req.headers.get("cookie") || "";
    const r = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const contentType = r.headers.get("content-type") || "application/json";
    const text = await r.text();

    if (!r.ok) {
      // 실패 시 그대로 바디/코드를 전달
      return new NextResponse(text, {
        status: r.status,
        headers: { "content-type": contentType },
      });
    }

    // Parse response body safely without using 'any'
    const data: RefreshResponse = {};
    try {
      const parsed: unknown = JSON.parse(text);
      if (isObject(parsed)) {
        const rt = parsed["refreshToken"];
        const at = parsed["accessToken"];
        const st = parsed["serverToken"];
        if (typeof rt === "string") data.refreshToken = rt;
        if (typeof at === "string") data.accessToken = at;
        if (typeof st === "string") data.serverToken = st;
        // copy through any other keys for transparency
        for (const [k, v] of Object.entries(parsed)) {
          if (!(k in data)) data[k] = v;
        }
      }
    } catch {}

    const response = new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    // 백엔드가 토큰을 바디로 내려주면 우리 도메인에 httpOnly 쿠키로 갱신
    if (data.refreshToken) {
      response.cookies.set("refreshToken", data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
    }
    const serverSideToken: string | undefined =
      data.serverToken || data.accessToken;
    if (serverSideToken) {
      response.cookies.set("serverToken", serverSideToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60,
        path: "/",
      });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[auth.refresh] refreshed", {
        hasAccess: !!data?.accessToken,
        setRefresh: !!data?.refreshToken,
        setServer: !!serverSideToken,
      });
    }

    return response;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[auth.refresh] error", e);
    }
    return NextResponse.json({ error: "refresh failed" }, { status: 500 });
  }
}
