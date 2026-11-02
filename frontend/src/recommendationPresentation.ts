import type { MemberSearchPreference, NoticeSummary } from "./api";
import { CATEGORY_LABELS, dateValue, formatArea, toApplication } from "./noticePresentation.ts";

function range(min: number | undefined, max: number | undefined, format: (value: number) => string, allowZero = true): string | undefined {
  const valid = (value: number) => Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
  if ((min != null && !valid(min)) || (max != null && !valid(max)) || (min != null && max != null && min > max)) return "범위 확인 필요";
  if (min != null && max != null) return min === max ? format(min) : `${format(min)} ~ ${format(max)}`;
  if (min != null) return `${format(min)} 이상`;
  if (max != null) return `${format(max)} 이하`;
  return undefined;
}

/** Only describe the preference version actually used by this recommendation response. */
export function recommendationCriteria(preference: MemberSearchPreference | undefined, appliedAt: string | null | undefined): string[] | undefined {
  if (!preference || !appliedAt || preference.updatedAt !== appliedAt) return undefined;
  const status = { ALL: "접수중·접수 예정", TODAY: "오늘 마감", OPEN: "접수중", UPCOMING: "접수 예정" }[preference.status];
  const criteria = [
    preference.region || "전국",
    preference.housingCategory ? CATEGORY_LABELS[preference.housingCategory] : "전체 주택유형",
    preference.supplyType === "SALE" ? "분양" : preference.supplyType === "PUBLIC_RENTAL" ? "임대" : "분양·임대",
    status,
  ];
  const amount = range(preference.minPriceManwon, preference.maxPriceManwon, value => `${value.toLocaleString("ko-KR")}만원`);
  const area = range(preference.minArea, preference.maxArea, formatArea, false);
  if (amount) criteria.push(`공고 금액 ${amount}`);
  if (area) criteria.push(`공급면적 ${area}`);
  return criteria;
}

export function recommendationNoticePresentation(notice: NoticeSummary) {
  const item = toApplication(notice);
  const start = dateValue(notice.applyStartDate) === undefined ? undefined : notice.applyStartDate;
  const end = dateValue(notice.applyEndDate) === undefined ? undefined : notice.applyEndDate;
  const period = start && end ? start <= end ? `${start} ~ ${end}` : "접수 일정 확인 필요"
    : start ? `${start} 시작 · 마감일 미확인`
      : end ? `시작일 미확인 · ${end} 마감` : "접수 일정 미확인";
  return {
    state: item.state,
    regionAndCategory: `${item.region} · ${item.category}`,
    price: item.price,
    area: range(notice.minArea, notice.maxArea, formatArea, false) ?? "미확인",
    period,
  };
}
