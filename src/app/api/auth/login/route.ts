import { NextRequest, NextResponse } from "next/server";

// ---- Types --------------------------------------------------------------
interface BackendLoginResponse {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  account?: unknown;
  message?: string;
  code?: string;
  [k: string]: unknown;
}

// ---- Helpers ------------------------------------------------------------
function errorJson(
  status: number,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { success: false, error: message, ...extra },
    { status }
  );
}

async function safeJson(res: Response): Promise<BackendLoginResponse> {
  try {
    return (await res.json()) as BackendLoginResponse;
  } catch {
    return {};
  }
}

function setHttpOnlyCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: { maxAgeSeconds: number }
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: options.maxAgeSeconds,
    path: "/",
  });
}

// 기본 10초 타임아웃
const LOGIN_TIMEOUT_MS = 10_000;

export async function POST(request: NextRequest) {
  const begunAt = Date.now();
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorJson(400, "JSON 파싱 실패 (잘못된 요청 본문)");
    }

    const loginId: string | undefined =
      body && typeof body === "object" && "loginId" in body
        ? String((body as Record<string, unknown>).loginId)
        : undefined;
    const password: string | undefined =
      body && typeof body === "object" && "password" in body
        ? String((body as Record<string, unknown>).password)
        : undefined;
    if (!loginId || !password) {
      return errorJson(400, "로그인아이디와 비밀번호를 입력해주세요.");
    }

    const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!backendBase) {
      return errorJson(500, "백엔드 URL이 설정되지 않았습니다.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

    let backendRes: Response;
    try {
      backendRes = await fetch(`${backendBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
        signal: controller.signal,
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "name" in e &&
        (e as { name?: string }).name === "AbortError"
      ) {
        return errorJson(504, "로그인 요청 시간 초과");
      }
      return errorJson(502, "백엔드 로그인 요청 실패");
    } finally {
      clearTimeout(timeout);
    }

    const data = await safeJson(backendRes);

    if (!backendRes.ok) {
      // backend 제공 message/code 우선
      return errorJson(
        backendRes.status,
        data.message || "로그인에 실패했습니다.",
        data.code ? { code: data.code } : undefined
      );
    }

    if (!data.accessToken) {
      return errorJson(502, "accessToken 누락 (백엔드 응답 오류)");
    }

    // 성공 응답 생성 (success true 추가 - 클라이언트가 사용 안하면 무시 가능)
    const response = NextResponse.json({
      success: true,
      accessToken: data.accessToken,
      tokenType: data.tokenType,
      expiresIn: data.expiresIn,
      account: data.account,
    });

    if (data.refreshToken) {
      setHttpOnlyCookie(response, "refreshToken", data.refreshToken, {
        maxAgeSeconds: 14 * 24 * 60 * 60, // 14일
      });
    }

    // SSR 용 serverToken: 현재는 accessToken 그대로 저장 (향후 별도 필드 나오면 교체 TODO)
    setHttpOnlyCookie(response, "serverToken", data.accessToken, {
      maxAgeSeconds: 60 * 60, // 1시간
    });

    // 진단용 헤더 (개발 환경에서만; 배포에서 원치 않으면 제거 가능)
    if (process.env.NODE_ENV !== "production") {
      response.headers.set("x-login-latency-ms", String(Date.now() - begunAt));
    }

    return response;
  } catch (error) {
    console.error("[auth/login] route error", error);
    return errorJson(500, "서버 오류가 발생했습니다.");
  }
}
