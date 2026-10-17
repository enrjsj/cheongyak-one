import { test } from "node:test";
import assert from "node:assert/strict";
import { areaSearchValue, areaValue, formatManwonInput, rangeFilterError } from "../src/rangeFilterTools.ts";
import { noticeSearchStateFromSearch, noticeSearchUrl, normalizeRecentNoticeSearches } from "../src/noticeTools.ts";
test("range filter accepts empty, single-sided, equal and bounded integer values", () => {
  for (const [min,max] of [["",""],["0","1000"],["59",""],["","84"],["84","84"]]) assert.equal(rangeFilterError(min,max,1000),"");
});
test("range filter rejects inverted, negative, fractional, exponent and oversized values", () => {
  for (const [min,max] of [["85","84"],["-1",""],["1.2",""],["1e2",""],["","1001"],["abc",""]]) assert.notEqual(rangeFilterError(min,max,1000),"");
});
test("budget hints preserve exact amounts without rounding", () => {
  for (const [input, expected] of [["", ""], ["abc", ""], ["-1", ""], ["1000001", ""], ["0", "0만원"], ["9500", "9,500만원"], ["30000", "3억"], ["30501", "3억 501만원"], ["1000000", "100억"]]) {
    assert.equal(formatManwonInput(input), expected);
  }
});
test("zero upper limits cannot silently become unlimited", () => {
  assert.notEqual(rangeFilterError("", "0", 1000), "");
  assert.notEqual(rangeFilterError("0", "000", 1000000), "");
  assert.equal(rangeFilterError("0", "", 1000), "");
});

test("area supports two decimal places without rounding, while budgets remain integers", () => {
  for (const value of ["0", "0.01", "59.5", "84.99", "1000", "1000.00"]) {
    assert.equal(areaValue(value), Number(value));
    assert.equal(rangeFilterError(value, "", 1000, true), "");
  }
  for (const value of ["", "59.", "1e2", "-1", "NaN", "Infinity", "59.999", "1000.01"]) assert.equal(areaValue(value), undefined);
  for (const [min, max] of [["59.999", ""], ["", "0.00"], ["84.99", "59.5"]]) assert.notEqual(rangeFilterError(min, max, 1000, true), "");
  assert.notEqual(rangeFilterError("59.5", "", 1000000), "");
});

test("decimal area survives URL and recent-search round trips", () => {
  assert.equal(areaSearchValue("0.00"), undefined);
  assert.equal(noticeSearchStateFromSearch("?minArea=0").minArea, undefined);
  const state = noticeSearchStateFromSearch("?minArea=59.5&maxArea=84.99");
  assert.equal(state.minArea, 59.5); assert.equal(state.maxArea, 84.99);
  assert.deepEqual(noticeSearchStateFromSearch(new URL(noticeSearchUrl("https://example.invalid/", state)).search), state);
  assert.deepEqual(normalizeRecentNoticeSearches([{ state, usedAt: 1 }])[0].state, state);
  assert.equal(noticeSearchStateFromSearch("?minArea=59.999&maxArea=1000.01").minArea, undefined);
});

