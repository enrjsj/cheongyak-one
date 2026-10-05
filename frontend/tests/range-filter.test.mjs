import { test } from "node:test";
import assert from "node:assert/strict";
import { formatManwonInput, rangeFilterError } from "../src/rangeFilterTools.ts";
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

