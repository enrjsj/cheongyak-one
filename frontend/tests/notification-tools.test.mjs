import assert from "node:assert/strict";
import test from "node:test";
import {
  filterNotifications,
  notificationCategory,
  notificationCategoryLabel,
  notificationFilterOptions,
  searchAndSortNotifications,
} from "../src/notificationTools.ts";

const notifications = [
  { id: 1, type: "APPLY_START", readAt: null },
  { id: 2, type: "NEW_MATCHING_NOTICE", readAt: "2026-09-27T00:00:00Z" },
  { id: 3, type: "NOTICE_UPDATED", readAt: null },
  { id: 4, type: "WINNER_ANNOUNCEMENT", readAt: null },
];

const searchable = [
  { id: 1, noticeTitle: "서울 청약", message: "접수 시작", createdAt: "2026-10-01T00:00:00Z", readAt: null },
  { id: 2, noticeTitle: "부산 ＡＰＴ", message: "마감 안내", createdAt: "2026-10-03T00:00:00Z", readAt: "2026-10-03T01:00:00Z" },
  { id: 3, noticeTitle: "서울 임대", message: "마감 안내", createdAt: "2026-10-02T00:00:00Z", readAt: null },
];
test("inbox search combines normalized title and message without changing its input", () => {
  const original = structuredClone(searchable);
  assert.deepEqual(searchAndSortNotifications(searchable, "  서울   마감 ", "NEWEST").map(x => x.id), [3]);
  assert.deepEqual(searchAndSortNotifications(searchable, "apt", "NEWEST").map(x => x.id), [2]);
  assert.deepEqual(searchAndSortNotifications(searchable, "없는 검색어", "NEWEST"), []);
  assert.deepEqual(searchable, original);
});
test("inbox sorting supports newest and unread-first with newest inside each group", () => {
  assert.deepEqual(searchAndSortNotifications(searchable, "", "NEWEST").map(x => x.id), [2, 3, 1]);
  assert.deepEqual(searchAndSortNotifications(searchable, " ", "UNREAD_FIRST").map(x => x.id), [3, 1, 2]);
});
test("inbox sorting handles invalid dates and equal timestamps deterministically", () => {
  const rows = [1, 2, 3].map(id => ({ ...searchable[0], id, createdAt: id === 1 ? "bad" : "2026-10-01" }));
  assert.deepEqual(searchAndSortNotifications(rows, "", "NEWEST").map(x => x.id), [3, 2, 1]);
});

test("notification filters separate unread, schedule, new, and updated notices", () => {
  assert.deepEqual(filterNotifications(notifications, "UNREAD").map(({ id }) => id), [1, 3, 4]);
  assert.deepEqual(filterNotifications(notifications, "SCHEDULE").map(({ id }) => id), [1, 4]);
  assert.deepEqual(filterNotifications(notifications, "NEW").map(({ id }) => id), [2]);
  assert.deepEqual(filterNotifications(notifications, "UPDATED").map(({ id }) => id), [3]);
  assert.deepEqual(notificationFilterOptions(notifications).map(({ label }) => label), ["전체 4", "읽지 않음 3", "일정 2", "신규 1", "변경 1"]);
});

test("notification category labels cover every delivered notification type", () => {
  assert.equal(notificationCategory("APPLY_DEADLINE_3D"), "SCHEDULE");
  assert.equal(notificationCategoryLabel("APPLY_DEADLINE_3D"), "마감 3일 전");
  assert.equal(notificationCategoryLabel("NEW_MATCHING_NOTICE"), "신규 공고");
  assert.equal(notificationCategoryLabel("NOTICE_UPDATED"), "공고 변경");
});
