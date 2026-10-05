import type { NoticeSearchState, RecentNoticeSearch } from "./noticeTools";

export function recentSearchLabel(state: NoticeSearchState): string {
  const range = (min: number | undefined, max: number | undefined, unit: string) =>
    `${min?.toLocaleString("ko-KR") ?? "0"}~${max?.toLocaleString("ko-KR") ?? "무제한"}${unit}`;
  return [
    state.query && `검색어 ${state.query}`,
    state.region,
    state.category && { APARTMENT: "아파트", PUBLIC_RENTAL: "공공임대", OFFICETEL: "오피스텔" }[state.category],
    state.supplyType && { SALE: "분양", PUBLIC_RENTAL: "공공임대 공급" }[state.supplyType],
    (state.minPriceManwon || state.maxPriceManwon) && range(state.minPriceManwon, state.maxPriceManwon, "만원"),
    (state.minArea || state.maxArea) && range(state.minArea, state.maxArea, "㎡"),
    state.status !== "all" && { today: "오늘 마감", open: "접수중", upcoming: "오픈 예정" }[state.status],
    state.includeClosed && "마감 공고 포함",
    state.sort !== "LATEST" && { DEADLINE: "마감 임박순", APPLY_START: "접수 시작일순", WINNER_ANNOUNCEMENT: "당첨 발표일순", PRICE_ASC: "낮은 분양가순", SUPPLY_DESC: "공급 세대 많은순" }[state.sort],
  ].filter(Boolean).join(" · ") || "전체 모집 중·예정";
}

export function removeRecentSearch(current: RecentNoticeSearch[], target: RecentNoticeSearch): RecentNoticeSearch[] {
  return current.filter(entry => entry !== target);
}
