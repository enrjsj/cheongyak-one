import { test } from "node:test";
import assert from "node:assert/strict";
import { appendUniqueNotices } from "../src/noticePagination.ts";
test("pagination retains current order and ignores overlapping and repeated IDs", () => {
  const current = [{ id: 1, title: "existing" }];
  const incoming = [{ id: 1, title: "overlap" }, { id: 2, title: "new" }, { id: 2, title: "duplicate" }, { id: 3, title: "last" }];
  const before = structuredClone({ current, incoming });
  const result = appendUniqueNotices(current, incoming);
  assert.deepEqual(result.items.map(item => item.id), [1, 2, 3]);
  assert.deepEqual(result.added.map(item => item.id), [2, 3]);
  assert.equal(result.items[0].title, "existing");
  assert.deepEqual({ current, incoming }, before);
});
test("empty or entirely repeated pages do not create false additions", () => {
  for (const incoming of [[], [{ id: 1 }]]) {
    const result = appendUniqueNotices([{ id: 1 }], incoming);
    assert.deepEqual(result.added, []); assert.deepEqual(result.items, [{ id: 1 }]);
  }
});
