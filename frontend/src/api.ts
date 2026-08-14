export type SourceSystem = "REB_APT" | "REB_OFFICETEL" | "MYHOME_PUBLIC_RENTAL";
export type HousingCategory = "APARTMENT" | "PUBLIC_RENTAL" | "OFFICETEL";
export type NoticeStatus = "UPCOMING" | "OPEN" | "CLOSED" | "ANNOUNCED";

export interface NoticeSummary {
  id: number;
  sourceSystem: SourceSystem;
  housingCategory: HousingCategory;
  status: NoticeStatus;
  title: string;
  regionCode?: string;
  address?: string;
  noticeDate?: string;
  applyStartDate?: string;
  applyEndDate?: string;
  winnerAnnounceDate?: string;
  totalUnits?: number;
  minPrice?: number;
  maxPrice?: number;
  officialUrl?: string;
  syncedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(response.status === 404
      ? "요청한 청약 공고를 찾지 못했습니다."
      : "청약 정보를 불러오지 못했습니다.");
  }

  return response.json() as Promise<T>;
}

export async function fetchNotices(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<PageResponse<NoticeSummary>> {
  return requestJson<PageResponse<NoticeSummary>>(`/api/v1/notices?${params.toString()}`, signal);
}

export async function fetchAllNotices(signal?: AbortSignal): Promise<NoticeSummary[]> {
  const notices: NoticeSummary[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const params = new URLSearchParams({ page: String(page), size: "100" });
    const response = await fetchNotices(params, signal);
    notices.push(...response.content);
    totalPages = response.totalPages;
    page += 1;
  }

  return notices;
}

export async function fetchNotice(id: number, signal?: AbortSignal): Promise<NoticeSummary> {
  return requestJson<NoticeSummary>(`/api/v1/notices/${id}`, signal);
}
