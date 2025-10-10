import { NextResponse } from "next/server";

export function GET() {
  // 환경변수 가져오기용
  const pub = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "").trim();
  const server = (process.env.PAYPAL_CLIENT_ID || "").trim();
  const clientId = pub || server;
  if (!clientId) return NextResponse.json({ clientId: null }, { status: 404 });
  return NextResponse.json({ clientId });
}
