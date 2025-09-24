import { NextResponse } from "next/server";

export async function POST() {
  // 우리 도메인의 httpOnly 쿠키 삭제
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set("serverToken", "", { path: "/", maxAge: 0 });
  res.cookies.set("refreshToken", "", { path: "/", maxAge: 0 });
  return res;
}
