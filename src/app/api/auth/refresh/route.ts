import { NextResponse } from "next/server";

type RefreshResponse = {
  refreshToken?: string;
  accessToken?: string;
  serverToken?: string;
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
      { error: "API 기본 URL 이 설정되지 않았습니다" },
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
      // 실패 시 백엔드 응답 바디와 상태코드를 그대로 전달
      return new NextResponse(text, {
        status: r.status,
        headers: { "content-type": contentType },
      });
    }

    // 응답 바디를 any 없이 안전하게 파싱
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
        // 투명성을 위해 쓰지 않는 키도 그대로 복사
        for (const [k, v] of Object.entries(parsed)) {
          if (!(k in data)) data[k] = v;
        }
      }
    } catch {}

    const response = new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    // 백엔드가 토큰을 바디로 내려주면 도메인에 httpOnly 쿠키로 갱신
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
    return NextResponse.json({ error: "토큰 갱신 실패" }, { status: 500 });
  }
}
