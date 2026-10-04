import assert from "node:assert/strict";
import test from "node:test";
import { checkedRecommendations } from "../src/recommendationTools.ts";
const item = { score: 30, reasons: ["지역 일치"], notice: { id: 1, title: "서울 공고" } };
const result = { configured: true, dismissedCount: 2, recommendations: [item] };
test("recommendations preserve ranking and input data", () => {
  const copy = structuredClone(result);
  assert.deepEqual(checkedRecommendations(result), copy);
  assert.deepEqual(result, copy);
});
test("empty recommendations and unconfigured state are valid results", () => {
  assert.equal(checkedRecommendations({ configured: false, dismissedCount: 0, recommendations: [] }).configured, false);
  assert.equal(checkedRecommendations({ ...result, recommendations: [] }).recommendations.length, 0);
});
test("malformed recommendations never become an empty or actionable list", () => {
  for (const value of [null, {}, { ...result, configured: undefined }, { ...result, dismissedCount: -1 },
    { ...result, dismissedCount: 1.2 }, { ...result, recommendations: [item, item] },
    ...[{ ...item, score: NaN }, { ...item, reasons: [null] }, { ...item, notice: null },
      { ...item, notice: { id: 0, title: "공고" } }].map(row => ({ ...result, recommendations: [row] }))]) {
    assert.throws(() => checkedRecommendations(value));
  }
});
