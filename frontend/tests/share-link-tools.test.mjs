import test from "node:test";
import assert from "node:assert/strict";
import { publicShareUrl } from "../src/shareLinkTools.ts";
const url = "https://user:pass@example.com/?q=서울&category=OFFICETEL&notice=9&compare=1,2&token=secret&email=private#private";
test("search shares keep only search state and exclude credentials and fragments", () => {
  const result = new URL(publicShareUrl(url, "search"));
  assert.equal(result.username, ""); assert.equal(result.password, ""); assert.equal(result.hash, "");
  assert.deepEqual([...result.searchParams], [["q", "서울"], ["category", "OFFICETEL"]]);
});
test("notice shares isolate the chosen notice from unrelated search and comparison state", () => {
  assert.equal(publicShareUrl(url, "notice", [3]), "https://example.com/?notice=3");
});
test("comparison shares use explicit deduplicated IDs instead of a stale address bar", () => {
  assert.equal(new URL(publicShareUrl(url, "comparison", [3, 2, 3, -1, NaN])).searchParams.get("compare"), "3,2");
  for (const ids of [[], [1], [1, 2, 3, 4]]) assert.throws(() => publicShareUrl(url, "comparison", ids));
});
test("invalid protocols and notice IDs are rejected", () => {
  for (const value of ["javascript:alert(1)", "file:///tmp/test", "invalid"]) assert.throws(() => publicShareUrl(value, "search"));
  for (const ids of [[], [0], [1.5], [1, 2]]) assert.throws(() => publicShareUrl(url, "notice", ids));
});
test("double-slash paths cannot change the destination origin", () => {
  const result = new URL(publicShareUrl("https://example.com//other.example/path?token=x", "notice", [1]));
  assert.equal(result.origin, "https://example.com");
  assert.equal(result.pathname, "//other.example/path");
});
