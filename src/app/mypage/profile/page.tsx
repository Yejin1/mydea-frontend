"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "../mypage.module.css";

type AccountProfileResponse = {
  id: number;
  loginId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  nickname?: string | null;
  phone: string | null;
  phoneVerified: boolean;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type UpdateProfileRequest = {
  name?: string;
  nickname?: string;
  phone?: string;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [initial, setInitial] = useState<AccountProfileResponse | null>(null);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    fetch("/api/account/me", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`프로필 조회 실패 (${r.status})`);
        return r.json();
      })
      .then((data: AccountProfileResponse) => {
        if (aborted) return;
        setInitial(data);
        setName(data.name || "");
        setNickname(data.nickname ?? "");
        setPhone(data.phone || "");
      })
      .catch(
        (e) => !aborted && setError(e.message || "프로필 조회에 실패했습니다.")
      )
      .finally(() => !aborted && setLoading(false));
    return () => {
      aborted = true;
    };
  }, []);

  const phoneValid = useMemo(() => {
    if (!phone) return true; // optional
    if (phone.length > 30) return false;
    return /^[0-9-]+$/.test(phone);
  }, [phone]);

  const nameValid = useMemo(() => {
    if (!name) return false; // name required
    return name.length <= 100;
  }, [name]);

  const nicknameValid = useMemo(() => {
    if (!nickname) return true; // optional
    return nickname.length <= 50;
  }, [nickname]);

  const canSave = useMemo(() => {
    if (!initial) return false;
    if (!nameValid || !phoneValid || !nicknameValid) return false;
    const changes: UpdateProfileRequest = {};
    if (name !== (initial.name || "")) changes.name = name.trim();
    if (nickname !== (initial.nickname ?? ""))
      changes.nickname = nickname.trim() || undefined;
    if (phone !== (initial.phone || ""))
      changes.phone = phone.trim() || undefined;
    return Object.keys(changes).length > 0;
  }, [initial, name, phone, nickname, nameValid, phoneValid, nicknameValid]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const body: UpdateProfileRequest = {};
    if (name !== (initial.name || "")) body.name = name.trim();
    if (nickname !== (initial.nickname ?? "")) {
      const trimmed = nickname.trim();
      if (trimmed) body.nickname = trimmed;
      else body.nickname = ""; // empty clears server-side
    }
    if (phone !== (initial.phone || "")) {
      const trimmed = phone.trim();
      if (trimmed) body.phone = trimmed;
      else body.phone = ""; // empty string to clear server-side
    }
    try {
      const r = await fetch("/api/account/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `저장 실패 (${r.status})`);
      }
      const updated: AccountProfileResponse = await r.json();
      setInitial(updated);
      setName(updated.name || "");
      setNickname(updated.nickname ?? "");
      setPhone(updated.phone || "");
      setSuccess("저장되었습니다.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err ?? "");
      setError(msg || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: "8px 0 16px" }}>개인정보 수정</h1>
      {loading ? (
        <p>불러오는 중…</p>
      ) : error ? (
        <div className={styles.errorText} style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : (
        <form onSubmit={onSubmit} aria-busy={saving}>
          <div className={styles.formGrid}>
            <label className={styles.label}>
              <span style={{ fontSize: 13, color: "#555" }}>이메일</span>
              <input
                type="email"
                value={initial?.email || ""}
                disabled
                className={styles.inputReadonly}
              />
            </label>
            <label className={styles.label}>
              <span style={{ fontSize: 13, color: "#555" }}>
                이름 <span className={styles.errorText}>*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                className={styles.input}
              />
            </label>
            <label className={styles.label}>
              <span style={{ fontSize: 13, color: "#555" }}>닉네임</span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={50}
                placeholder="닉네임"
                className={styles.input}
              />
              {!nicknameValid && (
                <span className={styles.errorText} style={{ fontSize: 12 }}>
                  닉네임은 최대 50자까지 입력할 수 있습니다.
                </span>
              )}
            </label>
            <label className={styles.label}>
              <span style={{ fontSize: 13, color: "#555" }}>휴대폰번호</span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="예) 010-1234-5678"
                className={styles.input}
              />
              {!phoneValid && (
                <span className={styles.errorText} style={{ fontSize: 12 }}>
                  숫자와 하이픈(-)만 입력 가능하며, 최대 30자입니다.
                </span>
              )}
            </label>
            <div className={styles.actions}>
              <button
                type="submit"
                disabled={!canSave || saving}
                className={`${styles.btnPrimary} ${
                  !canSave || saving ? styles.btnDisabled : ""
                }`}
              >
                {saving ? "저장 중…" : "저장"}
              </button>
              {success && <span className={styles.successText}>{success}</span>}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
