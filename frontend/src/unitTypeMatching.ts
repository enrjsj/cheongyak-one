import type { NoticeSearchRequest, NoticeUnitType } from "./api";

export type UnitRange = Pick<NoticeSearchRequest, "minPrice" | "maxPrice" | "minArea" | "maxArea">;

export function hasUnitRange(range: UnitRange): boolean {
  return [range.minPrice, range.maxPrice, range.minArea, range.maxArea].some(value => value !== undefined);
}

// The API uses the published maximum price of the same unit, with inclusive bounds.
// Unknown values cannot satisfy a requested bound; all unit rows remain visible.
export function unitMatchesRange(unit: NoticeUnitType, range: UnitRange): boolean {
  const within = (value: number | undefined, min?: number, max?: number) =>
    (min === undefined || Number.isFinite(value) && value! >= min)
    && (max === undefined || Number.isFinite(value) && value! <= max);
  return within(unit.maxPrice, range.minPrice, range.maxPrice)
    && within(unit.supplyArea, range.minArea, range.maxArea);
}
