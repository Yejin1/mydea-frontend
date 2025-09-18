import WorksClient from "./WorksClient";

export const dynamic = "force-dynamic";
import { WorkItem, WorksResult, PaginatedResponse } from "./types";

// 서버 컴포넌트: 목록 조회 (배열 또는 페이지 응답 모두 지원)
async function fetchWorks(page = 0, size = 20): Promise<WorksResult> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;

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
    const p = data as Partial<PaginatedResponse>;
    console.log(p);
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
