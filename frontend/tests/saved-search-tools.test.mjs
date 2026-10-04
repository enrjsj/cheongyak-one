import test from "node:test";
import assert from "node:assert/strict";
import { checkedSavedProfiles, savedProfileInputError, selectSavedProfiles } from "../src/savedSearchTools.ts";
const row = { id: 1, name: "서울 ＡＰＴ", region: "서울", status: "ALL", sort: "LATEST", defaultProfile: false, newNoticeEnabled: true, updatedAt: "2026-10-01" };
test("saved profile names and inverted ranges are validated", () => {
  for (const name of ["", "  ", "가".repeat(41)]) assert.ok(savedProfileInputError(name, {}));
  assert.equal(savedProfileInputError(" 이름 ", { minArea: 59, maxArea: 84 }), "");
  assert.ok(savedProfileInputError("이름", { minArea: 85, maxArea: 84 }));
  assert.ok(savedProfileInputError("이름", { minPriceManwon: 50000, maxPriceManwon: 40000 }));
});
test("saved profile ranges reject nonfinite, negative and excessive values", () => {
  for (const value of [NaN, Infinity, -1, 1001, "59"]) assert.ok(savedProfileInputError("이름", { minArea: value }));
  assert.equal(savedProfileInputError("이름", { minArea: 0, maxArea: 1000, maxPriceManwon: 1000000 }), "");
});
test("saved profile validation rejects malformed and ambiguous lists", () => {
  for (const value of [null, {}, [row, row], [{ ...row, name: "" }], [{ ...row, status: "BAD" }],
    [{ ...row, newNoticeEnabled: null }], [{ ...row, housingCategory: "BAD" }], [{ ...row, minArea: "bad" }],
    [{ ...row, defaultProfile: true }, { ...row, id: 2, defaultProfile: true }]]) assert.throws(() => checkedSavedProfiles(value));
  assert.deepEqual(checkedSavedProfiles([]), []);
  assert.deepEqual(checkedSavedProfiles([row]), [row]);
});
test("saved profile local search combines normalized name and summary without mutation", () => {
  const items = [row, { ...row, id: 2, name: "부산", region: "부산" }];
  const copy = structuredClone(items);
  assert.deepEqual(selectSavedProfiles(items, "apt  서울", "DEFAULT", item => item.region).map(x => x.id), [1]);
  assert.deepEqual(selectSavedProfiles(items, "없는 조건", "NAME", item => item.region), []);
  assert.deepEqual(items, copy);
});
test("saved profiles sort by default, recency and name with deterministic ties", () => {
  const items = [row, { ...row, id: 2, name: "가", updatedAt: "2026-10-02" }, { ...row, id: 3, name: "나", defaultProfile: true, updatedAt: "invalid" }];
  assert.deepEqual(selectSavedProfiles(items, "", "DEFAULT", () => "").map(x => x.id), [3, 2, 1]);
  assert.deepEqual(selectSavedProfiles(items, "", "RECENT", () => "").map(x => x.id), [2, 1, 3]);
  assert.deepEqual(selectSavedProfiles(items, "", "NAME", () => "").map(x => x.id), [2, 3, 1]);
});
