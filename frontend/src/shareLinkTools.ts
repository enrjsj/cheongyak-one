export type ShareKind = "search" | "notice" | "comparison";
const searchKeys = ["q", "status", "region", "category", "supplyType", "minPriceManwon", "maxPriceManwon", "minArea", "maxArea", "includeClosed", "sort"];

/** Share only the intended public navigation state, never arbitrary query/hash data. */
export function publicShareUrl(current: string, kind: ShareKind, ids: number[] = []): string {
  const source = new URL(current);
  if (!["http:", "https:"].includes(source.protocol)) throw new Error("공유 주소를 확인해주세요.");
  const result = new URL(source.origin);
  result.pathname = source.pathname;
  if (kind === "search") {
    for (const key of searchKeys) {
      const value = source.searchParams.get(key);
      if (value) result.searchParams.set(key, value);
    }
  } else {
    const valid = [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))];
    if (kind === "notice") {
      if (valid.length !== 1) throw new Error("공고를 확인해주세요.");
      result.searchParams.set("notice", String(valid[0]));
    } else {
      if (valid.length < 2 || valid.length > 3) throw new Error("비교할 공고를 2~3개 선택해주세요.");
      result.searchParams.set("compare", valid.join(","));
    }
  }
  return result.toString();
}
