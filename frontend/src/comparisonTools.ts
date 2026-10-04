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
  const cell = (value: string) => {
    // Spreadsheet programs may evaluate formula-like cells even when quoted.
    const safe = /^[\s\uFEFF]*[=+\-@]/u.test(value) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const data = [["비교 항목", ...items.map(item => item.title)], ...rows.map(row => [row.label, ...row.values]),
    ["공식 공고", ...items.map(item => safeOfficialUrl(item.officialUrl) ?? "링크 미제공")]];
  return "\uFEFF" + data.map(row => row.map(cell).join(",")).join("\r\n");
}
