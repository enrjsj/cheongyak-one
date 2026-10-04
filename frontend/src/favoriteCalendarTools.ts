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
  const seen = new Set<number>();
  return notices.filter(notice => {
    if (seen.has(notice.id)) return false;
    seen.add(notice.id);
    return true;
  }).flatMap((notice) => [
    notice.applyStartDate && { notice, date: notice.applyStartDate, type: "APPLY_START" as const, label: EVENT_LABELS.APPLY_START },
    notice.applyEndDate && { notice, date: notice.applyEndDate, type: "APPLY_END" as const, label: EVENT_LABELS.APPLY_END },
    notice.winnerAnnounceDate && { notice, date: notice.winnerAnnounceDate, type: "WINNER" as const, label: EVENT_LABELS.WINNER },
  ].filter((event): event is FavoriteCalendarEvent => Boolean(event) && isCalendarDate(event ? event.date : undefined)))
    .sort((left, right) => left.date.localeCompare(right.date) || left.notice.id - right.notice.id || left.type.localeCompare(right.type));
}

export function filterFavoriteCalendarEvents(
  events: FavoriteCalendarEvent[], filter: FavoriteCalendarFilter, includePast: boolean, today: string,
  options: { query?: string; month?: string } = {}
): FavoriteCalendarEvent[] {
  const terms = (options.query ?? "").normalize("NFKC").toLocaleLowerCase("ko-KR").trim().split(/\s+/).filter(Boolean);
  return events.filter((event) => {
    const text = `${event.notice.title} ${event.notice.regionCode ?? ""} ${event.notice.address ?? ""}`.normalize("NFKC").toLocaleLowerCase("ko-KR");
    return (includePast || event.date >= today) && (filter === "ALL" || event.type === filter)
      && (!options.month || event.date.startsWith(options.month + "-")) && terms.every(term => text.includes(term));
  });
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
  const [year, month] = date.split("-").map(Number);
  return `${year}년 ${month}월`;
}

export function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function koreaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function scheduleDayLabel(date: string, today: string): string {
  if (!isCalendarDate(date) || !isCalendarDate(today)) return "";
  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
  return days === 0 ? "오늘" : days > 0 ? `D-${days}` : `지난 ${-days}일`;
}

// Copy notices and clear unselected dates before using the existing ICS encoder.
export function calendarSelectionNotices(events: FavoriteCalendarEvent[]): NoticeSummary[] {
  const selected = new Map<number, NoticeSummary>();
  for (const event of events) {
    if (!isCalendarDate(event.date)) continue;
    const notice = selected.get(event.notice.id) ?? {
      ...event.notice, applyStartDate: undefined, applyEndDate: undefined, winnerAnnounceDate: undefined,
    };
    if (event.type === "APPLY_START") notice.applyStartDate = event.date;
    if (event.type === "APPLY_END") notice.applyEndDate = event.date;
    if (event.type === "WINNER") notice.winnerAnnounceDate = event.date;
    selected.set(event.notice.id, notice);
  }
  return [...selected.values()];
}
