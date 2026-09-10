import type { NoticeSummary } from "./api";

export type NoticeSortKey = "LATEST" | "DEADLINE";
export type NoticeFilterStatus = "all" | "today" | "open" | "upcoming";
export type NoticeFilterCategory = "APARTMENT" | "PUBLIC_RENTAL" | "OFFICETEL";

export interface NoticeSearchState {
  query: string;
  status: NoticeFilterStatus;
  region?: string;
  category?: NoticeFilterCategory;
  minPriceManwon?: number;
  maxPriceManwon?: number;
  sort: NoticeSortKey;
}

type SortableNotice = Pick<
  NoticeSummary,
  "id" | "noticeDate" | "applyStartDate" | "applyEndDate" | "winnerAnnounceDate" | "status"
>;

export interface ComparisonUpdate {
  ids: number[];
  added: boolean;
  limitReached: boolean;
}

/** URL의 notice 값이 양의 정수일 때만 상세 공고 ID로 사용한다. */
export function noticeIdFromSearch(search: string): number | undefined {
  const value = new URLSearchParams(search).get("notice");
  if (!value || !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** 기존 필터·비교 조건과 해시를 보존한 채 상세 공고 주소를 만든다. */
export function noticeUrl(currentUrl: string, noticeId?: number): string {
  const url = new URL(currentUrl);
  if (noticeId === undefined) url.searchParams.delete("notice");
  else url.searchParams.set("notice", String(noticeId));
  return url.toString();
}

/** 공유 URL의 검색 조건을 허용 목록과 길이 제한에 맞춰 복원한다. */
export function noticeSearchStateFromSearch(search: string): NoticeSearchState {
  const params = new URLSearchParams(search);
  const statusValue = params.get("status");
  const categoryValue = params.get("category");
  const minPriceManwon = positiveInteger(params.get("minPriceManwon"));
  const maxPriceManwon = positiveInteger(params.get("maxPriceManwon"));
  return {
    query: (params.get("q") ?? "").trim().slice(0, 100),
    status: (["today", "open", "upcoming"] as const).includes(statusValue as "today" | "open" | "upcoming")
      ? statusValue as NoticeFilterStatus
      : "all",
    region: (params.get("region") ?? "").trim().slice(0, 30) || undefined,
    category: (["APARTMENT", "PUBLIC_RENTAL", "OFFICETEL"] as const).includes(categoryValue as NoticeFilterCategory)
      ? categoryValue as NoticeFilterCategory
      : undefined,
    ...(minPriceManwon ? { minPriceManwon } : {}),
    ...(maxPriceManwon ? { maxPriceManwon } : {}),
    sort: params.get("sort") === "DEADLINE" ? "DEADLINE" : "LATEST",
  };
}

/** 다른 URL 상태는 보존하고 기본값이 아닌 검색 조건만 주소에 기록한다. */
export function noticeSearchUrl(currentUrl: string, state: NoticeSearchState): string {
  const url = new URL(currentUrl);
  const values: Array<[string, string | undefined]> = [
    ["q", state.query.trim().slice(0, 100) || undefined],
    ["status", state.status === "all" ? undefined : state.status],
    ["region", state.region?.trim().slice(0, 30) || undefined],
    ["category", state.category],
    ["minPriceManwon", state.minPriceManwon ? String(state.minPriceManwon) : undefined],
    ["maxPriceManwon", state.maxPriceManwon ? String(state.maxPriceManwon) : undefined],
    ["sort", state.sort === "LATEST" ? undefined : state.sort],
  ];
  for (const [name, value] of values) {
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  }
  return url.toString();
}

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : undefined;
}

/** 손상된 브라우저 저장값을 제거하고 최근 공고 ID 개수를 제한한다. */
export function normalizeRecentNoticeIds(value: unknown, maxSize = 5): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((id): id is number => Number.isSafeInteger(id) && id > 0))]
    .slice(0, Math.max(0, maxSize));
}

/** 방금 본 공고를 맨 앞으로 이동한다. */
export function updateRecentNoticeIds(currentIds: number[], noticeId: number, maxSize = 5): number[] {
  if (!Number.isSafeInteger(noticeId) || noticeId <= 0) return normalizeRecentNoticeIds(currentIds, maxSize);
  return normalizeRecentNoticeIds([noticeId, ...currentIds.filter((id) => id !== noticeId)], maxSize);
}

/** 비교 목록의 중복과 최대 개수를 한곳에서 관리한다. */
export function updateComparison(currentIds: number[], noticeId: number, maxSize = 3): ComparisonUpdate {
  if (currentIds.includes(noticeId)) {
    return {
      ids: currentIds.filter((id) => id !== noticeId),
      added: false,
      limitReached: false,
    };
  }

  if (currentIds.length >= maxSize) {
    return { ids: currentIds, added: false, limitReached: true };
  }

  return { ids: [...currentIds, noticeId], added: true, limitReached: false };
}

function deadlineValue(notice: SortableNotice): string {
  if (notice.status === "UPCOMING") return notice.applyStartDate ?? notice.applyEndDate ?? "9999-12-31";
  if (notice.status === "OPEN") return notice.applyEndDate ?? notice.applyStartDate ?? "9999-12-31";
  return notice.winnerAnnounceDate ?? notice.applyEndDate ?? "9999-12-31";
}

function deadlineStatusRank(notice: SortableNotice): number {
  if (notice.status === "OPEN" || notice.status === "UPCOMING") return 0;
  if (notice.status === "ANNOUNCED") return 1;
  return 2;
}

/** 원본 배열을 변경하지 않고 사용자 선택 기준으로 공고를 정렬한다. */
export function sortNotices<T extends SortableNotice>(notices: T[], sortKey: NoticeSortKey): T[] {
  return [...notices].sort((left, right) => {
    if (sortKey === "DEADLINE") {
      return deadlineStatusRank(left) - deadlineStatusRank(right)
        || deadlineValue(left).localeCompare(deadlineValue(right))
        || right.id - left.id;
    }

    return (right.noticeDate ?? "").localeCompare(left.noticeDate ?? "") || right.id - left.id;
  });
}

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function compactDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function nextDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + 1));
  return value.toISOString().slice(0, 10);
}

function utcTimestamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldCalendarLine(line: string): string[] {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;

  // RFC 5545 호환성을 위해 UTF-8 기준 75바이트에서 줄을 접는다.
  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    const byteLimit = parts.length === 0 ? 75 : 74;
    if (current && currentBytes + characterBytes > byteLimit) {
      parts.push(current);
      current = character;
      currentBytes = characterBytes;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }

  if (current || parts.length === 0) parts.push(current);
  return parts.map((part, index) => index === 0 ? part : ` ${part}`);
}

type CalendarEventType = "apply-start" | "apply-end" | "winner";

interface CalendarEvent {
  type: CalendarEventType;
  date: string;
  label: string;
}

function calendarEvents(notice: NoticeSummary): CalendarEvent[] {
  return [
    notice.applyStartDate && { type: "apply-start" as const, date: notice.applyStartDate, label: "청약 접수 시작" },
    notice.applyEndDate && { type: "apply-end" as const, date: notice.applyEndDate, label: "청약 접수 마감" },
    notice.winnerAnnounceDate && { type: "winner" as const, date: notice.winnerAnnounceDate, label: "당첨자 발표" },
  ].filter((event): event is CalendarEvent => Boolean(event));
}

/** 선택한 공고의 접수 시작·마감·발표 일정을 표준 iCalendar 파일로 만든다. */
export function buildNoticeCalendar(notices: NoticeSummary[], generatedAt = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cheongyak One//Notice Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:청약한눈 일정",
  ];

  for (const notice of notices) {
    for (const event of calendarEvents(notice)) {
      const description = [notice.address, notice.officialUrl].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:notice-${notice.id}-${event.type}@cheongyak-one`,
        `DTSTAMP:${utcTimestamp(generatedAt)}`,
        `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDate(event.date))}`,
        `SUMMARY:${escapeCalendarText(`[${event.label}] ${notice.title}`)}`,
        `DESCRIPTION:${escapeCalendarText(description)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return lines.flatMap(foldCalendarLine).join("\r\n") + "\r\n";
}
