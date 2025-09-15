import styles from "./myworks.module.css";

type WorkItem = {
  id: number;
  name: string;
  workType: "ring" | "bracelet" | "necklace";
  designType: "basic" | "flower";
  previewUrl: string | null;
  imageUrl?: string | null; // 과거 필드 호환 (백엔드 이전 버전)
  createdAt: string;
  updatedAt: string;
};

type PaginatedResponse = {
  content: WorkItem[];
  totalElements: number;
  totalPages: number;
  number: number; // current page index
  size: number; // page size
  first: boolean;
  last: boolean;
};

interface WorksResult {
  items: WorkItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// 서버 컴포넌트: 목록 조회 (배열 또는 페이지 응답 모두 지원)
async function fetchWorks(page = 0, size = 20): Promise<WorksResult> {
  // base URL 끝 슬래시 제거 (중복 // 방지)
  const rawBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
  const base = rawBase.replace(/\/$/, "");
  // 백엔드가 userId 요구할 수 있다는 가정 (필요 시 값 교체)
  const userId = 1; // TODO: 인증 연동 후 동적 값으로 교체
  const url = `${base}/api/works?userId=${userId}&page=${page}&size=${size}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {}
      console.error("[myworks] works fetch 실패", {
        status: res.status,
        url,
        body: bodyText?.slice(0, 500),
      });
      return {
        items: [],
        total: 0,
        page: 0,
        pageSize: size,
        totalPages: 0,
        first: true,
        last: true,
      };
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch (je) {
      console.error("[myworks] JSON 파싱 실패", je);
      return {
        items: [],
        total: 0,
        page: 0,
        pageSize: size,
        totalPages: 0,
        first: true,
        last: true,
      };
    }
    // 1) Array 모드
    if (Array.isArray(data)) {
      console.log("[myworks] works fetch success (array)", {
        count: data.length,
        first: data[0],
      });
      return {
        items: data as WorkItem[],
        total: data.length,
        page: 0,
        pageSize: data.length,
        totalPages: 1,
        first: true,
        last: true,
      };
    }
    // 2) Paginated 객체 모드
    const p = data as Partial<PaginatedResponse>;
    if (p && Array.isArray(p.content)) {
      console.log("[myworks] works fetch success (paginated)", {
        count: p.content.length,
        page: p.number,
        total: p.totalElements,
      });
      return {
        items: p.content as WorkItem[],
        total:
          typeof p.totalElements === "number"
            ? p.totalElements
            : p.content.length,
        page: typeof p.number === "number" ? p.number : 0,
        pageSize: typeof p.size === "number" ? p.size : p.content.length,
        totalPages: typeof p.totalPages === "number" ? p.totalPages : 1,
        first: !!p.first,
        last: !!p.last,
      };
    }
    console.warn("[myworks] 예상 외 응답 형식 (unknown)", data);
    return {
      items: [],
      total: 0,
      page: 0,
      pageSize: size,
      totalPages: 0,
      first: true,
      last: true,
    };
  } catch (e) {
    console.error("[myworks] works fetch 네트워크 오류", e);
    return {
      items: [],
      total: 0,
      page: 0,
      pageSize: size,
      totalPages: 0,
      first: true,
      last: true,
    };
  }
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

export default async function MyWorksPage() {
  const result = await fetchWorks();
  const { items: works, total, page, totalPages, first, last } = result;
  const count = works.length;

  return (
    <div className={styles.pageWrap}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>내 작업물</h1>
        <div className={styles.countInfo}>{total}개</div>
      </div>

      {count === 0 ? (
        <div className={styles.emptyState}>
          저장된 작업이 없습니다.
          <div style={{ marginTop: 12, fontSize: 13, color: "#888" }}>
            커스터마이저에서 첫 작품을 만들어보세요.
          </div>
        </div>
      ) : (
        <div className={styles.grid}>
          {works.map((w) => (
            <div key={w.id} className={styles.card}>
              <div className={styles.thumbWrap}>
                {w.previewUrl || w.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.previewUrl || w.imageUrl || ""}
                    alt={w.name}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.noImage}>미리보기 없음</span>
                )}
              </div>
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
          ))}
        </div>
      )}
      {/* 페이지네이션 (추후 기능 확장) */}
      {totalPages > 1 && (
        <div
          style={{
            marginTop: 32,
            display: "flex",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <button
            disabled={first}
            style={{
              padding: "6px 14px",
              border: "1px solid #ccc",
              borderRadius: 8,
              background: first ? "#f5f5f5" : "#fff",
            }}
          >
            이전
          </button>
          <div style={{ fontSize: 14 }}>
            Page {page + 1} / {totalPages}
          </div>
          <button
            disabled={last}
            style={{
              padding: "6px 14px",
              border: "1px solid #ccc",
              borderRadius: 8,
              background: last ? "#f5f5f5" : "#fff",
            }}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
