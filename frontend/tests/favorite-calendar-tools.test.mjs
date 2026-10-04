import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFavoriteCalendarEvents,
  favoriteCalendarEventCounts,
  filterFavoriteCalendarEvents,
  monthLabel,
  isCalendarDate, koreaToday, scheduleDayLabel, calendarSelectionNotices,
} from "../src/favoriteCalendarTools.ts";
import { buildNoticeCalendar } from "../src/noticeTools.ts";

const notice = { id: 1, title: "테스트 청약", applyStartDate: "2026-10-01", applyEndDate: "2026-10-05", winnerAnnounceDate: "2026-10-12" };

test("favorite calendar builds and filters schedule event types", () => {
  const events = buildFavoriteCalendarEvents([notice]);
  assert.deepEqual(events.map(({ type }) => type), ["APPLY_START", "APPLY_END", "WINNER"]);
  assert.deepEqual(filterFavoriteCalendarEvents(events, "APPLY_END", false, "2026-10-01").map(({ date }) => date), ["2026-10-05"]);
  assert.deepEqual(filterFavoriteCalendarEvents(events, "ALL", false, "2026-10-06").map(({ type }) => type), ["WINNER"]);
  assert.deepEqual(favoriteCalendarEventCounts(events), { ALL: 3, APPLY_START: 1, APPLY_END: 1, WINNER: 1 });
  assert.equal(monthLabel("2026-10-12"), "2026년 10월");
});

test("calendar rejects malformed dates and impossible days but accepts leap dates", () => {
  for (const value of ["", "2026-2-03", "2026-02-29", "2026-04-31", "2026-13-01", "2026-10-01T00:00:00Z", undefined]) {
    assert.equal(isCalendarDate(value), false);
  }
  assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(buildFavoriteCalendarEvents([{ ...notice, applyStartDate: "2026-02-29", applyEndDate: undefined, winnerAnnounceDate: undefined }]).length, 0);
});

test("calendar deduplicates notices and does not mutate input", () => {
  const items = [notice, { ...notice }];
  const copy = structuredClone(items);
  assert.equal(buildFavoriteCalendarEvents(items).length, 3);
  assert.deepEqual(items, copy);
});

test("calendar query and month apply before type counts", () => {
  const events = buildFavoriteCalendarEvents([notice, { ...notice, id: 2, title: "서울 ＡＰＴ", address: "강남", applyStartDate: "2026-11-01" }]);
  const scoped = filterFavoriteCalendarEvents(events, "ALL", true, "2026-10-01", { query: "apt  강남", month: "2026-10" });
  assert.deepEqual(favoriteCalendarEventCounts(scoped), { ALL: 2, APPLY_START: 0, APPLY_END: 1, WINNER: 1 });
  assert.equal(filterFavoriteCalendarEvents(events, "ALL", true, "2026-10-01", { query: "없는 공고" }).length, 0);
  assert.equal(filterFavoriteCalendarEvents(events, "ALL", false, "2026-10-06", { month: "2026-10" }).length, 2);
});

test("Korean day boundary and D-day calculations use calendar dates", () => {
  assert.equal(koreaToday(new Date("2026-12-31T14:59:59Z")), "2026-12-31");
  assert.equal(koreaToday(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
  assert.equal(scheduleDayLabel("2027-01-01", "2026-12-31"), "D-1");
  assert.equal(scheduleDayLabel("2026-12-31", "2026-12-31"), "오늘");
  assert.equal(scheduleDayLabel("2026-12-30", "2026-12-31"), "지난 1일");
  assert.equal(scheduleDayLabel("bad", "2026-12-31"), "");
  assert.notEqual(monthLabel("2026-10"), monthLabel("2027-10"));
});

test("filtered calendar export keeps only selected event dates and preserves source data", () => {
  const events = buildFavoriteCalendarEvents([notice]);
  const selected = calendarSelectionNotices(events.filter(event => event.type === "APPLY_END"));
  assert.equal(selected[0].applyStartDate, undefined);
  assert.equal(selected[0].winnerAnnounceDate, undefined);
  assert.equal(notice.applyStartDate, "2026-10-01");
  const ics = buildNoticeCalendar(selected, new Date("2026-10-01T00:00:00Z"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.match(ics, /DTSTART;VALUE=DATE:20261005/);
  assert.match(ics, /DTEND;VALUE=DATE:20261006/);
  assert.doesNotMatch(ics, /notice-1-apply-start|notice-1-winner/);
  assert.deepEqual(calendarSelectionNotices([]), []);
});
