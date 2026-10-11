import type { NoticeDetail } from "./api";

export type NoticeQualityItem = { code: string; kind: "미제공" | "확인 필요"; message: string };

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Describe the received detail only: absence does not prove a collection failure.
export function noticeQualityItems(notice: NoticeDetail): NoticeQualityItem[] {
  const items: NoticeQualityItem[] = [];
  const add = (code: string, kind: NoticeQualityItem["kind"], message: string) => items.push({ code, kind, message });
  if (!notice.businessEntityName?.trim()) add("supplier", "미제공", "공급기관을 공식 공고문에서 확인하세요.");
  const start = notice.applyStartDate, end = notice.applyEndDate;
  if (!start || !end) add("period-missing", "미제공", "접수 시작일 또는 마감일을 확인하세요.");
  if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && validDate(start) && validDate(end) && start > end)) {
    add("period-invalid", "확인 필요", "접수 날짜 또는 기간의 순서를 공식 공고문과 비교하세요.");
  }
  const prices = [notice.minPrice, notice.maxPrice];
  const priceName = notice.housingCategory === "PUBLIC_RENTAL" ? "임대보증금" : "분양가";
  if (prices.some(value => value == null)) add("price-missing", "미제공", `${priceName} 범위의 일부 또는 전체가 제공되지 않았습니다.`);
  if (prices.some(value => value != null && (!Number.isFinite(value) || value < 0)) || (notice.minPrice != null && notice.maxPrice != null && notice.minPrice > notice.maxPrice)) {
    add("price-invalid", "확인 필요", `${priceName} 금액 또는 범위의 순서를 공식 공고문과 비교하세요.`);
  }
  if ((notice.housingCategory === "APARTMENT" || notice.housingCategory === "OFFICETEL") && !notice.unitTypes?.length) {
    add("units", "미제공", "주택형별 면적·공급 세대·분양가는 공식 공고문에서 확인하세요.");
  }
  return items;
}
