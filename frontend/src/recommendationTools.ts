import type { MemberRecommendationList } from "./api";

// Reject malformed responses instead of presenting them as an empty recommendation.
export function checkedRecommendations(value: unknown): MemberRecommendationList {
  const data = value as MemberRecommendationList | null;
  if (!data || typeof data.configured !== "boolean" || !Number.isSafeInteger(data.dismissedCount)
    || data.dismissedCount < 0 || !Array.isArray(data.recommendations)) {
    throw new Error("맞춤 추천 응답을 확인하지 못했습니다.");
  }
  const ids = new Set<number>();
  for (const item of data.recommendations) {
    if (!item || !Number.isFinite(item.score) || !Array.isArray(item.reasons)
      || item.reasons.some(reason => typeof reason !== "string")
      || !item.notice || !Number.isSafeInteger(item.notice.id) || item.notice.id <= 0
      || typeof item.notice.title !== "string" || ids.has(item.notice.id)) {
      throw new Error("맞춤 추천 응답을 확인하지 못했습니다.");
    }
    ids.add(item.notice.id);
  }
  return data;
}
