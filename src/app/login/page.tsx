"use client";

import styles from "./page.module.css";
import { PretendardRegular, PretendardExtraBold } from "@/app/fonts";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // next 우선, 그다음 redirect, 기본은 루트; 안전을 위해 내부 경로만 허용
  const rawNext =
    searchParams.get("next") || searchParams.get("redirect") || "/";
  const redirectTo =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onGuestLogin() {
    setError(null);
    setLoading(true);
    try {
      // 고정된 방문자 계정으로 일반 로그인 API 호출 (쿠키 기반 세션 설정)
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loginId: "guest", password: "20250924" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "방문자 로그인에 실패했습니다."
        );
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "방문자 로그인에 실패했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!loginId || !password) {
        throw new Error("로그인아이디와 비밀번호를 입력해주세요.");
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginId,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "로그인에 실패했습니다.");
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "로그인에 실패했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${styles.page} ${PretendardRegular.className}`}>
      <div className={styles.card}>
        <h1 className={`${styles.title} ${PretendardExtraBold.className}`}>
          로그인
        </h1>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="loginId">
              로그인 아이디 <span className={styles.required}>*</span>
            </label>
            <input
              id="loginId"
              className={styles.input}
              type="text"
              placeholder="아이디"
              value={loginId}
              onChange={(e) =>
                setLoginId(
                  e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "")
                )
              }
              autoComplete="username"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              pattern="^[a-z0-9]+$"
              title="알파벳 소문자와 숫자만 입력해주세요."
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              비밀번호 <span className={styles.required}>*</span>
            </label>
            <input
              id="password"
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              className={`${styles.button} ${PretendardExtraBold.className}`}
              type="submit"
              disabled={loading}
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
            <button
              className={`${styles.guestButton} ${PretendardExtraBold.className}`}
              type="button"
              onClick={onGuestLogin}
              disabled={loading}
            >
              {loading ? "로그인 중..." : "방문자용 로그인"}
            </button>
            <div className={styles.helper}>
              아직 계정이 없으신가요? <Link href="/signup">회원가입</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.page}>로딩 중…</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
