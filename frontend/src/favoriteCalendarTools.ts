import type { NoticeSummary } from "./api";

export type FavoriteCalendarEventType = "APPLY_START" | "APPLY_END" | "WINNER";
export type FavoriteCalendarFilter = "ALL" | FavoriteCalendarEventType;

export interface FavoriteCalendarEvent {
  notice: NoticeSummary;
  date: string;
  type: FavoriteCalendarEventType;
  label: string;
}

const EVENT_LABELS: Record<FavoriteCalendarEventType, string> = {
  APPLY_START: "접수 시작",
  APPLY_END: "접수 마감",
  WINNER: "당첨 발표",
};

export function buildFavoriteCalendarEvents(notices: NoticeSummary[]): FavoriteCalendarEvent[] {
  return notices.flatMap((notice) => [
    notice.applyStartDate && { notice, date: notice.applyStartDate, type: "APPLY_START" as const, label: EVENT_LABELS.APPLY_START },
    notice.applyEndDate && { notice, date: notice.applyEndDate, type: "APPLY_END" as const, label: EVENT_LABELS.APPLY_END },
    notice.winnerAnnounceDate && { notice, date: notice.winnerAnnounceDate, type: "WINNER" as const, label: EVENT_LABELS.WINNER },
  ].filter((event): event is FavoriteCalendarEvent => Boolean(event))).sort((left, right) => left.date.localeCompare(right.date));
}

export function filterFavoriteCalendarEvents(
  events: FavoriteCalendarEvent[], filter: FavoriteCalendarFilter, includePast: boolean, today: string
): FavoriteCalendarEvent[] {
  return events.filter((event) => (includePast || event.date >= today) && (filter === "ALL" || event.type === filter));
}

export function favoriteCalendarEventCounts(events: FavoriteCalendarEvent[]): Record<FavoriteCalendarFilter, number> {
  return {
    ALL: events.length,
    APPLY_START: events.filter((event) => event.type === "APPLY_START").length,
    APPLY_END: events.filter((event) => event.type === "APPLY_END").length,
    WINNER: events.filter((event) => event.type === "WINNER").length,
  };
}

export function monthLabel(date: string): string {
  const [, month] = date.split("-").map(Number);
  return `${month}월`;
}
