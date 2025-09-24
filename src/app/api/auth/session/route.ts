import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const hasServerToken = /(?:^|;\s*)serverToken=([^;]+)/.test(cookie);
  // 세션 API는 민감 정보 최소화: 로그인 여부와 계정 표시용 최소 정보만
  // 필요 시 서버에서 /me 호출로 확장 가능
  return NextResponse.json({ loggedIn: hasServerToken });
}
