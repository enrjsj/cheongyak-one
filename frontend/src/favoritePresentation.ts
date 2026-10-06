import type { FavoriteProgress, FavoriteApplicationResult, FavoriteTracker } from "./api";
import { daysBetween, koreaToday } from "./noticePresentation";

export type FavoriteProgressFilter = FavoriteProgress | "ALL" | "INCOMPLETE" | "URGENT" | "RESULT_DUE" | "RESULT_PENDING" | "RESULT_SELECTED" | "RESULT_WAITLISTED" | "RESULT_NOT_SELECTED";
export type FavoriteChecklistKey = "noticeDocumentChecked" | "eligibilityChecked" | "scheduleChecked" | "fundsChecked";
export type FavoriteSortKey = "PREPARATION" | "DEADLINE" | "RESULT";

export const FAVORITE_PROGRESS_LABELS: Record<FavoriteProgress, string> = {
  SAVED: "저장만 함",
  CHECKING: "조건 확인 중",
  READY: "신청 준비 완료",
  APPLIED: "신청 완료",
};

export const FAVORITE_PROGRESS_PRIORITY: Record<FavoriteProgress, number> = {
  CHECKING: 0,
  READY: 1,
  SAVED: 2,
  APPLIED: 3,
};

export const FAVORITE_APPLICATION_RESULT_LABELS: Record<FavoriteApplicationResult, string> = {
  PENDING: "발표 대기",
  SELECTED: "당첨",
  WAITLISTED: "예비 당첨",
  NOT_SELECTED: "미당첨",
};

export const FAVORITE_APPLICATION_RESULT_PRIORITY: Record<FavoriteApplicationResult, number> = {
  PENDING: 0,
  WAITLISTED: 1,
  SELECTED: 2,
  NOT_SELECTED: 3,
};

export const FAVORITE_CHECKLIST_ITEMS: { key: FavoriteChecklistKey; label: string }[] = [
  { key: "noticeDocumentChecked", label: "공고문 확인" },
  { key: "eligibilityChecked", label: "자격 조건 확인" },
  { key: "scheduleChecked", label: "접수 일정 확인" },
  { key: "fundsChecked", label: "자금 계획 확인" },
];

export function completedChecklistCount(tracker?: FavoriteTracker): number {
  return FAVORITE_CHECKLIST_ITEMS.filter(({ key }) => tracker?.[key]).length;
}

export function incompleteChecklistLabels(tracker?: FavoriteTracker): string {
  return FAVORITE_CHECKLIST_ITEMS.filter(({ key }) => !tracker?.[key]).map(({ label }) => label).join(" · ");
}

export function applicationResultFromFilter(filter: FavoriteProgressFilter): FavoriteApplicationResult | undefined {
  if (!filter.startsWith("RESULT_")) return undefined;
  return filter.slice("RESULT_".length) as FavoriteApplicationResult;
}

export function resultDueLabel(winnerAnnounceDate?: string): string {
  if (!winnerAnnounceDate) return "발표일 확인 필요";
  const remaining = daysBetween(koreaToday(), winnerAnnounceDate);
  if (remaining === undefined) return "발표일 확인 필요";
  if (remaining === 0) return "오늘 발표";
  return remaining < 0 ? `${Math.abs(remaining)}일 전 발표` : `D-${remaining} 발표`;
}

