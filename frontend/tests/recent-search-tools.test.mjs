import { test } from "node:test";
import assert from "node:assert/strict";
import { recentSearchLabel, removeRecentSearch } from "../src/recentSearchTools.ts";
const state = { query: "", status: "all", sort: "LATEST", includeClosed: false };
test("recent search labels distinguish every stored restriction and sort", () => {
  assert.equal(recentSearchLabel(state), "전체 모집 중·예정");
  assert.equal(recentSearchLabel({ ...state, query: "강남", region: "서울", category: "OFFICETEL", supplyType: "SALE", minPriceManwon: 10000, maxPriceManwon: 30000, minArea: 20, maxArea: 80, status: "today", includeClosed: true, sort: "PRICE_ASC" }), "검색어 강남 · 서울 · 오피스텔 · 분양 · 10,000~30,000만원 · 20~80㎡ · 오늘 마감 · 마감 공고 포함 · 낮은 분양가순");
  assert.equal(recentSearchLabel({ ...state, maxArea: 40 }), "0~40㎡");
});
test("removing one recent entry preserves order, identical timestamps and source values", () => {
  const first = { state, usedAt: 1 };
  const second = { state: { ...state, region: "서울" }, usedAt: 1 };
  const source = [first, second];
  assert.deepEqual(removeRecentSearch(source, first), [second]);
  assert.deepEqual(source, [first, second]);
});
