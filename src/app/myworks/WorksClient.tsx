"use client";
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import styles from "./myworks.module.css";
import type { WorkItem } from "./types";

interface WorksClientProps {
  initialResult: {
    items: WorkItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    first: boolean;
    last: boolean;
  };
  blobBase: string;
}

function badgeLabelWorkType(t: WorkItem["workType"]) {
  switch (t) {
    case "ring":
      return "반지";
    case "bracelet":
      return "팔찌";
    case "necklace":
      return "목걸이";
    default:
      return t;
  }
}

function badgeLabelDesignType(t: WorkItem["designType"]) {
  switch (t) {
    case "basic":
      return "베이직";
    case "flower":
      return "플라워";
    default:
      return t;
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * 공통 fetch 래퍼
 * - 401이면 /api/auth/refresh 시도 후 원 요청 1회 재시도
 * - 그래도 401이면 로그인 페이지로 이동(+ next 파라미터)
 */
async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;

  // 토큰 갱신 시도
  const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
  if (refreshed.ok) {
    const retry = await fetch(input, init);
    if (retry.status !== 401) return retry;
  }

  // 여전히 401 → 로그인 페이지로
  if (typeof window !== "undefined") {
    const next = encodeURIComponent(
      window.location.pathname + window.location.search
    );
    window.location.href = `/login?next=${next}`;
  }
  return res;
}

export default function WorksClient({
  initialResult,
  blobBase,
}: WorksClientProps) {
  const [items, setItems] = useState<WorkItem[]>(initialResult.items);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);
  const total = initialResult.total;

  // 로컬 환경에서만 ID 표시
  useEffect(() => {
    try {
      const host = window.location.hostname;
      setIsLocal(host === "localhost" || host === "127.0.0.1");
    } catch {
      setIsLocal(false);
    }
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items, selectedIds]
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (items.length === 0) return new Set(prev);
      if (prev.size === items.length) return new Set();
      return new Set(items.map((i) => i.id));
    });
  }, [items]);

  const handleDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(`선택한 ${count}개 항목을 삭제할까요?`)) return;
    setDeleteError(null);

    startDelete(async () => {
      try {
        const res = await apiFetch("/api/works", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Array.from(selectedIds)),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `삭제 실패 (${res.status})`);
        }

        // 성공 시 로컬 목록에서 제거
        setItems((prev) => prev.filter((w) => !selectedIds.has(w.id)));
        setSelectedIds(new Set());
      } catch (e: unknown) {
        let msg = "삭제 실패";
        if (e && typeof e === "object" && "message" in e) {
          const m = (e as { message?: string }).message;
          if (typeof m === "string" && m.trim()) msg = m;
        }
        setDeleteError(msg);
      }
    });
  };

  // WorksClient 내부
  // async function load(page = 0, size = 20) {
  //   const res = await fetch(`/api/works?page=${page}&size=${size}`, {
  //     cache: "no-store",
  //   });
  //   if (!res.ok) throw new Error(await res.text());
  //   return res.json();
  // }

  return (
    <div className={styles.pageWrap}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>내 저장함</h1>
        <div className={styles.countInfo}>{total}개</div>
      </div>

      <div className={styles.selectionBar}>
        <label className={styles.selectAllLabel}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
          />
          전체선택
        </label>
        <button
          type="button"
          onClick={handleDelete}
          disabled={selectedIds.size === 0 || deleting}
          className={[
            styles.deleteBtn,
            selectedIds.size === 0 || deleting ? styles.deleteBtnDisabled : "",
          ].join(" ")}
        >
          {deleting ? "삭제중..." : `삭제 (${selectedIds.size})`}
        </button>
      </div>

      {deleteError && <div className={styles.errorMsg}>{deleteError}</div>}

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          저장된 작업이 없습니다.
          <div className={styles.emptyHint}>
            커스터마이저에서 첫 작품을 만들어보세요.
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((w) => {
            const imgSrc =
              w.signedPreviewUrl ||
              w.imageUrl ||
              (blobBase ? `${blobBase}/work-${w.id}.png` : "");
            const checked = selectedIds.has(w.id);
            return (
              <div key={w.id} className={styles.card}>
                <Link
                  href={`/customizer?workId=${w.id}`}
                  prefetch={false}
                  className={styles.thumbWrap}
                >
                  {imgSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgSrc} alt={w.name} loading="lazy" />
                  ) : (
                    <span className={styles.noImage}>미리보기 없음</span>
                  )}
                </Link>
                <div className={styles.body}>
                  <div className={styles.nameRow}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(w.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={checked ? "선택 해제" : "선택"}
                      className={styles.checkbox}
                    />
                    {/* 이름 표시 일단 숨김
                    <div className={styles.name}>{w.name}</div>
                    */}
                    {isLocal && (
                      <span className={styles.localId}>(id: {w.id})</span>
                    )}
                  </div>
                  <div className={styles.badges}>
                    <span
                      className={`${styles.badge} ${
                        styles["workType-" + w.workType] || ""
                      } badge workType-${w.workType}`}
                    >
                      {badgeLabelWorkType(w.workType)}
                    </span>
                    <span
                      className={`${styles.badge} ${
                        styles["designType-" + w.designType] || ""
                      } badge designType-${w.designType}`}
                    >
                      {badgeLabelDesignType(w.designType)}
                    </span>
                  </div>
                  <div className={styles.metaRow}>
                    <span>생성: {formatDate(w.createdAt)}</span>
                    <span>수정: {formatDate(w.updatedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
