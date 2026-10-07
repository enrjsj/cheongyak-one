import type { NoticeUnitType } from "./api";

export const UNIT_SORT_LABELS = {
  ORIGINAL: "공고 기본 순서", PRICE_ASC: "낮은 분양가순", PRICE_DESC: "높은 분양가순",
  AREA_ASC: "작은 면적순", AREA_DESC: "큰 면적순", SUPPLY_DESC: "공급 세대 많은순",
} as const;
export type UnitSort = keyof typeof UNIT_SORT_LABELS;
export type UnitMetric = "supplyArea" | "maxPrice" | "generalSupplyCount" | "specialSupplyCount" | "totalSupplyCount";

// Missing, non-finite and invalid source values never become zero in ordering or comparison.
export function unitValue(unit: NoticeUnitType, field: UnitMetric): number | undefined {
  const value = unit[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  if (field === "supplyArea") return value > 0 ? value : undefined;
  return Number.isSafeInteger(value) ? value : undefined;
}

export function sortUnitTypes(units: NoticeUnitType[], sort: UnitSort): NoticeUnitType[] {
  if (sort === "ORIGINAL") return [...units];
  const field = sort.startsWith("PRICE") ? "maxPrice" : sort.startsWith("AREA") ? "supplyArea" : "totalSupplyCount";
  const direction = sort.endsWith("ASC") ? 1 : -1;
  return [...units].sort((a, b) => {
    const left = unitValue(a, field), right = unitValue(b, field);
    if (left === undefined) return right === undefined ? 0 : 1;
    if (right === undefined) return -1;
    return (left - right) * direction;
  });
}

export function unitDifference(unit: NoticeUnitType, baseline: NoticeUnitType, field: UnitMetric): number | undefined {
  const value = unitValue(unit, field), base = unitValue(baseline, field);
  if (value === undefined || base === undefined) return undefined;
  return field === "supplyArea" ? Math.round((value - base) * 100) / 100 : value - base;
}
