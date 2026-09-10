import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNoticeCalendar,
  noticeIdFromSearch,
  noticeSearchStateFromSearch,
  noticeSearchUrl,
  noticeUrl,
  normalizeRecentNoticeIds,
  sortNotices,
  updateComparison,
  updateRecentNoticeIds,
} from "../src/noticeTools.ts";

const baseNotice = {
  id: 10,
  sourceSystem: "REB_APT",
  housingCategory: "APARTMENT",
  status: "OPEN",
  title: "서울, 테스트; 단지",
  address: "서울시 강남구\\테스트",
  noticeDate: "2026-09-01",
  applyStartDate: "2026-09-03",
  applyEndDate: "2026-09-05",
  winnerAnnounceDate: "2026-09-10",
  officialUrl: "https://example.com/notices/10",
  syncedAt: "2026-09-03T00:00:00Z",
};

test("comparison toggles notices and enforces the three-item limit", () => {
  assert.deepEqual(updateComparison([1, 2], 3), {
    ids: [1, 2, 3],
    added: true,
    limitReached: false,
  });
  assert.deepEqual(updateComparison([1, 2, 3], 4), {
    ids: [1, 2, 3],
    added: false,
    limitReached: true,
  });
  assert.deepEqual(updateComparison([1, 2, 3], 2).ids, [1, 3]);
});

test("notice deep link validates ids and preserves existing URL state", () => {
  assert.equal(noticeIdFromSearch("?notice=42&sort=DEADLINE"), 42);
  assert.equal(noticeIdFromSearch("?notice=0"), undefined);
  assert.equal(noticeIdFromSearch("?notice=3.5"), undefined);
  assert.equal(noticeIdFromSearch("?notice=-1"), undefined);

  const detailUrl = noticeUrl("https://example.com/?compare=1%2C2#applications", 42);
  assert.equal(detailUrl, "https://example.com/?compare=1%2C2&notice=42#applications");
  assert.equal(noticeUrl(detailUrl), "https://example.com/?compare=1%2C2#applications");
});

test("notice search URL restores valid filters and drops invalid values", () => {
  const sharedUrl = noticeSearchUrl("https://example.com/?notice=7", {
    query: " 은평 청약 ",
    status: "open",
    region: "서울",
    category: "APARTMENT",
    minPriceManwon: 30000,
    maxPriceManwon: 60000,
    sort: "DEADLINE",
  });
  const restored = noticeSearchStateFromSearch(new URL(sharedUrl).search);

  assert.deepEqual(restored, {
    query: "은평 청약",
    status: "open",
    region: "서울",
    category: "APARTMENT",
    minPriceManwon: 30000,
    maxPriceManwon: 60000,
    sort: "DEADLINE",
  });
  assert.equal(new URL(sharedUrl).searchParams.get("notice"), "7");
  assert.deepEqual(noticeSearchStateFromSearch("?status=closed&category=HOUSE&sort=NEW"), {
    query: "",
    status: "all",
    region: undefined,
    category: undefined,
    sort: "LATEST",
  });
});

test("recent notices are deduplicated, validated, and limited", () => {
  assert.deepEqual(normalizeRecentNoticeIds([3, 3, -1, "2", 2, 1], 3), [3, 2, 1]);
  assert.deepEqual(updateRecentNoticeIds([3, 2, 1], 2), [2, 3, 1]);
  assert.deepEqual(updateRecentNoticeIds([5, 4, 3, 2, 1], 6), [6, 5, 4, 3, 2]);
});

test("deadline sorting keeps closed notices after actionable notices", () => {
  const notices = [
    { ...baseNotice, id: 1, status: "CLOSED", applyEndDate: "2026-09-01" },
    { ...baseNotice, id: 2, status: "OPEN", applyEndDate: "2026-09-08" },
    { ...baseNotice, id: 3, status: "UPCOMING", applyStartDate: "2026-09-04" },
    { ...baseNotice, id: 4, status: "ANNOUNCED", winnerAnnounceDate: "2026-09-02" },
  ];

  assert.deepEqual(sortNotices(notices, "DEADLINE").map(({ id }) => id), [3, 2, 4, 1]);
});

test("calendar export creates all-day events and escapes user-facing text", () => {
  const calendar = buildNoticeCalendar([baseNotice], new Date("2026-09-03T01:02:03Z"));

  assert.match(calendar, /DTSTAMP:20260903T010203Z/);
  assert.match(calendar, /DTSTART;VALUE=DATE:20260905\r\nDTEND;VALUE=DATE:20260906/);
  assert.match(calendar, /SUMMARY:\[청약 접수 마감\] 서울\\, 테스트\\; 단지/);
  assert.match(calendar, /UID:notice-10-winner@cheongyak-one/);
  assert.ok(calendar.replace(/\r\n /g, "").includes("DESCRIPTION:서울시 강남구\\\\테스트\\nhttps://example.com/notices/10"));
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 3);
  for (const line of calendar.trimEnd().split("\r\n")) {
    assert.ok(new TextEncoder().encode(line).length <= 75, `calendar line exceeds 75 bytes: ${line}`);
  }
});
