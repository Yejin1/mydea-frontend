// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 보호가 필요한 경로 프리픽스들만 골라서 거른다
const PROTECTED = ["/myworks", "/settings"];

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // 1) 보호 경로가 아니면 통과
  const needsAuth = PROTECTED.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  // 2) API 라우트는 리다이렉트 대신 401을 주는 게 UX/호환성이 좋다
  const isApi = pathname.startsWith("/api/");
  const access = req.cookies.get("serverToken")?.value;

  if (!access) {
    if (isApi) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    // 3) 페이지 요청이면 로그인으로 보냄 (원래 가려던 경로를 next 파라미터에 보존)
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "next",
      pathname + (searchParams.toString() ? `?${searchParams}` : "")
    );
    return NextResponse.redirect(url);
  }

  // 4) 토큰이 있으면 통과 (엄격 모드에서는 아래 ‘선택: 만료 검사’ 활용)
  return NextResponse.next();
}

// 어떤 요청에 미들웨어를 적용할지 매칭
export const config = {
  matcher: [
    // 보호 경로만 지정하는 방식(권장)
    "/myworks/:path*",
    "/settings/:path*",
  ],
};
