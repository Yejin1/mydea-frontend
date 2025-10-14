import { NextRequest } from "next/server";
import {
  getBase,
  extractRefreshCookie,
  authHeaders,
  tryRefresh,
  passThroughResponse,
  applyRefreshedCookies,
  errorJson,
} from "@/app/api/cart/_proxyUtil";

// 계정 프로필 프록시: GET(조회), PATCH(수정)
// 인증: serverToken/refreshToken을 사용해 401 발생 시 자동 갱신 후 재시도
async function proxyMe(req: NextRequest) {
  const base = getBase();
  if (!base) return errorJson(500, "백엔드 BASE URL 미설정");
  const refreshCookie = extractRefreshCookie(req.headers.get("cookie"));
  const serverToken =
    req.cookies.get("serverToken")?.value ||
    req.cookies.get("accessToken")?.value ||
    "";

  const target = `${base}/api/account/me`;
  const needBody = req.method === "PATCH";
  const rawBody = needBody ? await req.arrayBuffer() : undefined;

  // 1차 시도: 현재 토큰으로 요청
  let r: Response;
  try {
    r = await fetch(target, {
      method: req.method,
      headers: authHeaders(req, serverToken, refreshCookie, ["content-type"]),
      cache: "no-store",
      body: needBody && rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error: experimental duplex
      duplex: needBody ? "half" : undefined,
    });
  } catch {
    return errorJson(502, "업스트림 요청 실패");
  }
  if (r.status !== 401 || !refreshCookie) return passThroughResponse(r);

  // 401이면서 refresh 쿠키가 있으면 토큰 갱신 시도
  const { token: newToken, payload } = await tryRefresh(base, refreshCookie);
  if (!newToken) return passThroughResponse(r);

  try {
    r = await fetch(target, {
      method: req.method,
      headers: authHeaders(req, newToken, refreshCookie, ["content-type"]),
      cache: "no-store",
      body: needBody && rawBody && rawBody.byteLength ? rawBody : undefined,
      signal: req.signal,
      // @ts-expect-error: experimental duplex
      duplex: needBody ? "half" : undefined,
    });
  } catch {
    return errorJson(502, "업스트림 요청 실패(갱신 후)");
  }
  const out = passThroughResponse(r);
  applyRefreshedCookies(out, payload, newToken);
  return out;
}

export function GET(req: NextRequest) {
  return proxyMe(req);
}

export function PATCH(req: NextRequest) {
  return proxyMe(req);
}
