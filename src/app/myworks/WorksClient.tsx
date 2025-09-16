"use client";
import { useState, useTransition } from "react";
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

export default function WorksClient({
  initialResult,
  blobBase,
}: WorksClientProps) {
  const [items, setItems] = useState<WorkItem[]>(initialResult.items);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const total = initialResult.total;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(items.map((i) => i.id));
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`선택한 ${selectedIds.length}개 항목을 삭제할까요?`)) return;
    setDeleteError(null);
    startDelete(async () => {
      try {
        const res = await fetch("/api/works", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selectedIds),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `삭제 실패 (${res.status})`);
        }
        // 성공 시 로컬 목록에서 제거
        setItems((prev) => prev.filter((w) => !selectedIds.includes(w.id)));
        setSelectedIds([]);
      } catch (e: any) {
        setDeleteError(e.message || "삭제 실패");
      }
    });
  };

  return (
    <div className={styles.pageWrap}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>내 작업물</h1>
        <div className={styles.countInfo}>{total}개</div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
          />{" "}
          전체선택
        </label>
        <button
          type="button"
          onClick={handleDelete}
          disabled={selectedIds.length === 0 || deleting}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            background: selectedIds.length === 0 ? "#eee" : "#ff4d4f",
            color: selectedIds.length === 0 ? "#666" : "#fff",
            border: "none",
            borderRadius: 6,
            cursor: selectedIds.length === 0 ? "default" : "pointer",
          }}
        >
          {deleting ? "삭제중..." : `삭제 (${selectedIds.length})`}
        </button>
        {deleteError && (
          <span style={{ color: "red", fontSize: 12 }}>{deleteError}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className={styles.emptyState}>
          저장된 작업이 없습니다.
          <div style={{ marginTop: 12, fontSize: 13, color: "#888" }}>
            커스터마이저에서 첫 작품을 만들어보세요.
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((w) => {
            const imgSrc =
              w.previewUrl ||
              w.imageUrl ||
              (blobBase ? `${blobBase}/work-${w.id}.png` : "");
            const checked = selectedIds.includes(w.id);
            return (
              <div
                key={w.id}
                className={styles.card}
                style={{ position: "relative" }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleSelect(w.id);
                  }}
                  aria-label={checked ? "선택 해제" : "선택"}
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.9)",
                    border: checked ? "2px solid #4a67ff" : "2px solid #ccc",
                    borderRadius: 6,
                    cursor: "pointer",
                    zIndex: 2,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      background: checked ? "#4a67ff" : "transparent",
                      borderRadius: 2,
                      transition: "background .15s",
                    }}
                  />
                </button>
                <Link
                  href={`/customizer?workId=${w.id}`}
                  prefetch={false}
                  className={styles.thumbWrap}
                  style={{ display: "block" }}
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
                    <div className={styles.name}>{w.name}</div>
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
