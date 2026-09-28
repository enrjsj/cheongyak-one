import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFavoriteCalendarEvents,
  favoriteCalendarEventCounts,
  filterFavoriteCalendarEvents,
  monthLabel,
} from "../src/favoriteCalendarTools.ts";

const notice = { id: 1, title: "테스트 청약", applyStartDate: "2026-10-01", applyEndDate: "2026-10-05", winnerAnnounceDate: "2026-10-12" };

test("favorite calendar builds and filters schedule event types", () => {
  const events = buildFavoriteCalendarEvents([notice]);
  assert.deepEqual(events.map(({ type }) => type), ["APPLY_START", "APPLY_END", "WINNER"]);
  assert.deepEqual(filterFavoriteCalendarEvents(events, "APPLY_END", false, "2026-10-01").map(({ date }) => date), ["2026-10-05"]);
  assert.deepEqual(filterFavoriteCalendarEvents(events, "ALL", false, "2026-10-06").map(({ type }) => type), ["WINNER"]);
  assert.deepEqual(favoriteCalendarEventCounts(events), { ALL: 3, APPLY_START: 1, APPLY_END: 1, WINNER: 1 });
  assert.equal(monthLabel("2026-10-12"), "10월");
});
