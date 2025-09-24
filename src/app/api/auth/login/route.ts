import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { loginId, password } = await request.json();

    if (!loginId || !password) {
      return NextResponse.json(
        { error: "로그인아이디와 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 백엔드 API로 로그인 요청
    const backendUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

    const backendResponse = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ loginId, password }),
    });

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.message || "로그인에 실패했습니다." },
        { status: backendResponse.status }
      );
    }

    // 보안 강화: httpOnly 쿠키에 refreshToken 저장
    const response = NextResponse.json({
      accessToken: data.accessToken,
      tokenType: data.tokenType,
      expiresIn: data.expiresIn,
      account: data.account,
    });

    // refreshToken이나 serverToken을 httpOnly 쿠키로 설정
    if (data.refreshToken) {
      response.cookies.set("refreshToken", data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 14 * 24 * 60 * 60, // 14일
        path: "/",
      });
    }

    // 서버 전용 토큰: 백엔드가 제공하면 우선 사용, 없으면 accessToken을 사용해 SSR 인증 지원
    const serverSideToken: string = data.accessToken;
    if (serverSideToken) {
      response.cookies.set("serverToken", serverSideToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60, // 1일
        path: "/",
      });
    }

    //(임시) 디버깅용 로그
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth.login] cookies set", {
        hasRefresh: !!data.refreshToken,
        serverTokenFrom: data.serverToken
          ? "backend"
          : data.accessToken
          ? "accessToken"
          : "none",
      });
    }

    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
