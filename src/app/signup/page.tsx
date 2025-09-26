"use client";

import styles from "./page.module.css";
import { PretendardRegular } from "@/app/fonts"; // remove unused PretendardExtraBold
import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dupOk, setDupOk] = useState<boolean | null>(null);
  const [dupMsg, setDupMsg] = useState<string>("");
  const [successOpen, setSuccessOpen] = useState(false);

  function formatPhone(input: string) {
    const digits = input.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function sanitizeLoginId(input: string) {
    return input.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function validate() {
    if (!loginId) return "로그인 아이디를 입력해주세요.";
    if (loginId.length < 3) return "아이디는 3자 이상이어야 합니다.";
    if (!password) return "비밀번호를 입력해주세요.";
    if (password.length < 6) return "비밀번호는 6자 이상이어야 합니다.";
    if (password !== confirm) return "비밀번호가 일치하지 않습니다.";
    if (phone && !/^\d{3}-\d{4}-\d{4}$/.test(phone))
      return "휴대폰 번호는 000-0000-0000 형식으로 입력해주세요.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        loginId,
        password,
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
      };

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = "회원가입 요청에 실패했습니다.";
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
          else if (typeof data === "string") msg = data;
        } catch {
          try {
            const text = await res.text();
            if (text) msg = text;
          } catch {
            /* ignore */
          }
        }
        throw new Error(msg);
      }

      // 성공 시 모달 오픈
      setSuccessOpen(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function checkDuplicate() {
    setDupOk(null);
    setDupMsg("");
    if (!loginId || loginId.trim().length < 3) {
      setDupOk(false);
      setDupMsg("아이디는 3자 이상 입력해주세요.");
      return;
    }
    setChecking(true);
    try {
      const url = `/api/auth/check-login-id?loginId=${encodeURIComponent(
        loginId.trim()
      )}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        let msg = "중복 확인 요청에 실패했습니다.";
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const data: { loginId?: string; available?: boolean } = await res.json();
      const available = Boolean(data?.available);
      setDupOk(available);
      setDupMsg(
        available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다."
      );
    } catch {
      setDupOk(false);
      setDupMsg("중복 확인에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={`${styles.page} ${PretendardRegular.className}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>회원가입</h1>
        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="loginId">
              로그인 아이디 <span className={styles.required}>*</span>
            </label>
            <div className={styles.row}>
              <input
                id="loginId"
                className={styles.input}
                type="text"
                placeholder="아이디"
                value={loginId}
                onChange={(e) => {
                  setLoginId(sanitizeLoginId(e.target.value));
                  setDupOk(null);
                  setDupMsg("");
                }}
                autoComplete="username"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                pattern="^[a-z0-9]+$"
                title="알파벳 소문자와 숫자만 입력해주세요."
                required
              />
              <button
                type="button"
                onClick={checkDuplicate}
                className={styles.secondaryButton}
                disabled={checking || loginId.trim().length < 3}
              >
                {checking ? "확인 중..." : "중복 확인"}
              </button>
            </div>
            {dupMsg && (
              <div
                className={`${styles.hint} ${dupOk ? styles.ok : styles.bad}`}
              >
                {dupMsg}
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              이름 (선택)
            </label>
            <input
              id="name"
              className={styles.input}
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone">
              휴대폰 번호 (선택)
            </label>
            <input
              id="phone"
              className={styles.input}
              type="tel"
              placeholder="010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              autoComplete="tel"
              inputMode="tel"
              pattern="^\d{3}-\d{4}-\d{4}$"
              maxLength={13}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              이메일 (선택)
            </label>
            <input
              id="email"
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              autoComplete="new-password"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirm">
              비밀번호 확인 <span className={styles.required}>*</span>
            </label>
            <input
              id="confirm"
              className={styles.input}
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "처리 중..." : "회원가입"}
            </button>
            <p className={styles.note}>
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className={styles.link}>
                로그인 페이지로 이동합니다.
              </Link>
            </p>
          </div>
        </form>
      </div>

      {successOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>가입이 완료되었습니다</h2>
            <p className={styles.modalText}>
              이제 로그인 페이지로 이동할 수 있어요.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.button}
                onClick={() => (window.location.href = "/login")}
              >
                로그인 하러 가기
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => setSuccessOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
