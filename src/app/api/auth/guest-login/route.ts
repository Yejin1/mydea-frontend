import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // 방문자용 로그인은 별도의 자격증명 없이 임시 토큰 발급
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";

    const backendResponse = await fetch(`${backendUrl}/api/auth/guest-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: data.message || "방문자 로그인에 실패했습니다." },
        { status: backendResponse.status }
      );
    }

    // 성공 응답을 그대로 전달
    return NextResponse.json(data);
  } catch (error) {
    console.error("Guest login API error:", error);

    // 백엔드 서버와 연결이 안 될 경우 임시 방문자 토큰 발급
    return NextResponse.json({
      accessToken: "guest-token-" + Date.now(),
      tokenType: "Bearer",
      expiresIn: 3600,
      account: {
        id: 0,
        loginId: "guest",
        name: "방문자",
        role: "GUEST",
        status: "ACTIVE",
      },
    });
  }
}
