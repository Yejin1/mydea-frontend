"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Navbar.module.css";
import { usePathname } from "next/navigation";

type Session = {
  loggedIn: boolean;
  account?: { id: number; loginId?: string; name?: string } | null;
};

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session>({ loggedIn: false });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // 외부 클릭으로 닫기
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/session", { cache: "no-store" });
      if (r.ok) {
        const s = (await r.json()) as Session;
        setSession(s);
      }
    } catch {}
  }, []);

  // 최초 마운트 및 경로 변경 시 세션 재확인
  useEffect(() => {
    fetchSession();
  }, [fetchSession, pathname]);

  const handleLogout = async () => {
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (r.ok) {
        // 상태 갱신
        setSession({ loggedIn: false, account: null });
        setOpen(false);
        // 현재 페이지 새로고침으로 보호 페이지에서 벗어나거나 상태 반영
        window.location.reload();
      }
    } catch {}
  };

  return (
    <div ref={menuRef} className={styles.userMenuWrap}>
      <button
        type="button"
        className={styles.userMenuButton}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) fetchSession();
            return next;
          });
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        title={session.loggedIn ? session.account?.name || "내 계정" : "로그인"}
      >
        <span aria-hidden="true" className={styles.userIconMask} role="img" />
      </button>
      {open && (
        <div className={styles.userDropdown} role="menu">
          {session.loggedIn ? (
            <>
              <button
                type="button"
                className={styles.userMenuItem}
                role="menuitem"
                onClick={() => {
                  alert("준비중입니다");
                  setOpen(false);
                }}
              >
                마이페이지
              </button>
              <button
                type="button"
                className={styles.userMenuItem}
                onClick={handleLogout}
                role="menuitem"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <a className={styles.userMenuItem} href="/login" role="menuitem">
                로그인
              </a>
              <a className={styles.userMenuItem} href="/signup" role="menuitem">
                회원가입
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
