import type { SavedSearchProfile, SearchPreferenceInput } from "./api";

export function savedProfileInputError(name: string, input: SearchPreferenceInput): string {
  if (!name.trim() || name.trim().length > 40) return "조건 이름을 1~40자로 입력해주세요.";
  for (const [min, max, limit, label] of [
    [input.minPriceManwon, input.maxPriceManwon, 1000000, "예산"],
    [input.minArea, input.maxArea, 1000, "면적"],
  ] as const) {
    if ([min, max].some(value => value != null && (!Number.isFinite(value) || value < 0 || value > limit))) return label + " 범위를 확인해주세요.";
    if (min != null && max != null && min > max) return label + " 최솟값은 최댓값보다 클 수 없습니다.";
  }
  return "";
}

export function checkedSavedProfiles(value: unknown): SavedSearchProfile[] {
  if (!Array.isArray(value)) throw new Error("저장 조건 목록을 확인하지 못했습니다.");
  const ids = new Set<number>();
  for (const row of value) {
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)
      || typeof row.name !== "string" || !row.name.trim()
      || typeof row.defaultProfile !== "boolean" || typeof row.newNoticeEnabled !== "boolean"
      || typeof row.updatedAt !== "string"
      || (row.region != null && typeof row.region !== "string")
      || (row.housingCategory != null && !["APARTMENT", "PUBLIC_RENTAL", "OFFICETEL"].includes(row.housingCategory))
      || (row.supplyType != null && !["SALE", "PUBLIC_RENTAL"].includes(row.supplyType))
      || !["ALL", "TODAY", "OPEN", "UPCOMING"].includes(row.status)
      || !["LATEST", "DEADLINE", "APPLY_START", "WINNER_ANNOUNCEMENT", "PRICE_ASC", "SUPPLY_DESC"].includes(row.sort)) {
      throw new Error("저장 조건 목록을 확인하지 못했습니다.");
    }
    if (savedProfileInputError(row.name, row)) throw new Error("저장 조건 범위를 확인하지 못했습니다.");
    ids.add(row.id);
  }
  if (value.filter(row => row.defaultProfile).length > 1) throw new Error("기본 저장 조건을 확인하지 못했습니다.");
  return value;
}

export function selectSavedProfiles(items: SavedSearchProfile[], query: string, order: "DEFAULT" | "NAME" | "RECENT", summary: (item: SavedSearchProfile) => string): SavedSearchProfile[] {
  const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase("ko-KR");
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return items.filter(item => terms.every(term => normalize(item.name + " " + summary(item)).includes(term)))
    .sort((a, b) => (order === "DEFAULT" ? Number(b.defaultProfile) - Number(a.defaultProfile) : 0)
      || (order === "NAME" ? a.name.localeCompare(b.name, "ko") : time(b.updatedAt) - time(a.updatedAt)) || a.id - b.id);
}

export function filterSavedProfiles(items: SavedSearchProfile[], notice: "ALL" | "ON" | "OFF", defaultOnly: boolean): SavedSearchProfile[] {
  return items.filter(item => (!defaultOnly || item.defaultProfile)
    && (notice === "ALL" || item.newNoticeEnabled === (notice === "ON")));
}
