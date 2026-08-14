export type HousingCategory = "APARTMENT" | "PUBLIC_RENTAL" | "OFFICETEL";
export type NoticeStatus = "UPCOMING" | "OPEN" | "CLOSED" | "ANNOUNCED";

export interface NoticeSummary {
  id: number;
  housingCategory: HousingCategory;
  status: NoticeStatus;
  title: string;
  regionCode?: string;
  address?: string;
  applyStartDate?: string;
  applyEndDate?: string;
  totalUnits?: number;
  minPrice?: number;
  maxPrice?: number;
  officialUrl?: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function fetchNotices(params: URLSearchParams): Promise<PageResponse<NoticeSummary>> {
  const response = await fetch(`/api/v1/notices?${params.toString()}`);
  if (!response.ok) {
    throw new Error("청약 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<PageResponse<NoticeSummary>>;
}
