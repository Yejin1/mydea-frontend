import WorksClient from "./WorksClient"; // 동적 오류 없으므로 확장자 및 expect-error 제거

// 이 페이지는 항상 최신 데이터를 위해 서버 동적 렌더링 강제
export const dynamic = "force-dynamic";
import { WorkItem, WorksResult, PaginatedResponse } from "./types";

// 타입은 types.ts 분리

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
      if (process.env.NODE_ENV !== "production") {
        console.error("[myworks] works fetch 실패", {
          status: res.status,
          url,
          body: bodyText?.slice(0, 500),
        });
      }
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
      if (process.env.NODE_ENV !== "production")
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
      if (process.env.NODE_ENV !== "production") {
        console.log("[myworks] works fetch success (array)", {
          count: data.length,
          first: data[0],
        });
      }
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
      if (process.env.NODE_ENV !== "production") {
        console.log("[myworks] works fetch success (paginated)", {
          count: p.content.length,
          page: p.number,
          total: p.totalElements,
        });
      }
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
    if (process.env.NODE_ENV !== "production")
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
    if (process.env.NODE_ENV !== "production")
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

// 라벨 변환은 클라이언트 컴포넌트에서 처리

// formatDate 함수는 클라이언트 측에서만 필요할 경우 WorksClient 쪽으로 두고 이곳에서는 제거

export default async function MyWorksPage() {
  const result = await fetchWorks();
  const blobBase = (process.env.NEXT_PUBLIC_WORKS_BLOB_BASE || "").replace(
    /\/$/,
    ""
  );
  return <WorksClient initialResult={result} blobBase={blobBase} />;
}
