import assert from "node:assert/strict";
import test from "node:test";
import {
  filterNotifications,
  notificationCategory,
  notificationCategoryLabel,
  notificationFilterOptions,
} from "../src/notificationTools.ts";

const notifications = [
  { id: 1, type: "APPLY_START", readAt: null },
  { id: 2, type: "NEW_MATCHING_NOTICE", readAt: "2026-09-27T00:00:00Z" },
  { id: 3, type: "NOTICE_UPDATED", readAt: null },
  { id: 4, type: "WINNER_ANNOUNCEMENT", readAt: null },
];

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
