import type { NoticeSummary } from "./api";

type Supply = Pick<NoticeSummary, "housingCategory" | "rentType">;

// Match the API predicate; titles and housing detail descriptions are not authoritative.
export function isRentalNotice(notice: Supply): boolean {
  return notice.housingCategory === "PUBLIC_RENTAL" || notice.rentType?.includes("임대") === true;
}

export function noticePriceLabel(notice: Supply): string {
  if (notice.housingCategory === "PUBLIC_RENTAL") return "임대보증금";
  // REB rental price data does not establish deposit/monthly rent/conversion semantics.
  return isRentalNotice(notice) ? "공고 금액" : "분양가";
}
