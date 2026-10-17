import { dateValue, type Application } from "./noticePresentation.ts";
import { csvCell } from "./fileExport.ts";

// Build lossless comparison values from the source, never from rounded card labels.
export function toComparisonItem(item: Application): ComparisonItem {
  const date = (value?: string) => dateValue(value) === undefined ? "미확인" : value!;
  const amount = (value?: number) => value != null && Number.isSafeInteger(value) && value >= 0
    ? `${value.toLocaleString("ko-KR")}원` : "미확인";
  const reversedPrice = item.minPrice != null && item.maxPrice != null && item.minPrice > item.maxPrice;
  const reversedPeriod = dateValue(item.applyStartDate) !== undefined && dateValue(item.applyEndDate) !== undefined
    && item.applyStartDate! > item.applyEndDate!;
  return {
    ...item,
    period: reversedPeriod ? "접수 일정은 공고문 확인" : `시작 ${date(item.applyStartDate)} — 마감 ${date(item.applyEndDate)}`,
    winnerDate: date(item.winnerAnnounceDate),
    price: reversedPrice ? `${item.priceLabel} 범위 확인 필요`
      : `${item.priceLabel} 최소 ${amount(item.minPrice)} — 최대 ${amount(item.maxPrice)}`,
  };
}

export type ComparisonGroup = "ALL" | "BASIC" | "SCHEDULE" | "COST";
export interface ComparisonItem {
  id: number; title: string; category: string; region: string; location: string;
  state: string; dday: string; period: string; winnerDate: string; price: string; scale: string; officialUrl?: string;
}
export interface ComparisonRow { key: string; label: string; group: Exclude<ComparisonGroup, "ALL">; values: string[]; different: boolean; }
export function comparisonRows(items: ComparisonItem[]): ComparisonRow[] {
  const fields: [string, string, Exclude<ComparisonGroup, "ALL">, (item: ComparisonItem) => string][] = [
    ["category", "주택 유형", "BASIC", item => item.category],
    ["location", "지역·위치", "BASIC", item => [item.region, item.location].filter(Boolean).join(" · ")],
    ["status", "현재 상태", "SCHEDULE", item => [item.state, item.dday].filter(Boolean).join(" · ")],
    ["period", "접수 일정", "SCHEDULE", item => item.period],
    ["winner", "당첨 발표", "SCHEDULE", item => item.winnerDate],
    ["price", "가격·보증금", "COST", item => item.price],
    ["scale", "공급 규모", "COST", item => item.scale],
  ];
  return fields.map(([key, label, group, read]) => {
    const values = items.map(item => read(item)?.trim() || "정보 미제공");
    return { key, label, group, values, different: new Set(values).size > 1 };
  });
}
export function selectComparisonRows(rows: ComparisonRow[], group: ComparisonGroup, differentOnly: boolean): ComparisonRow[] {
  return rows.filter(row => (group === "ALL" || row.group === group) && (!differentOnly || row.different));
}
export function safeOfficialUrl(value?: string): string | undefined {
  try { const url = new URL(value ?? ""); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined; } catch { return undefined; }
}
export function comparisonCsv(items: ComparisonItem[], rows: ComparisonRow[]): string {
  const data = [["비교 항목", ...items.map(item => item.title)], ...rows.map(row => [row.label, ...row.values]),
    ["공식 공고", ...items.map(item => safeOfficialUrl(item.officialUrl) ?? "링크 미제공")]];
  return "\uFEFF" + data.map(row => row.map(csvCell).join(",")).join("\r\n");
}
