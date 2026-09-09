import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEligibilityCheckResult,
  eligibilityQuestions,
} from "../src/eligibilityTools.ts";

test("pre-check offers an unknown choice for every question", () => {
  assert.equal(eligibilityQuestions.length, 4);
  for (const question of eligibilityQuestions) {
    assert.ok(question.options.some(({ value }) => value === "UNKNOWN"));
  }
});

test("pre-check returns verification items instead of an eligibility verdict", () => {
  const result = buildEligibilityCheckResult(["YES", "YES", "YES", "YES"]);

  assert.equal(result.headline, "공고별 세부 조건을 확인해 주세요");
  assert.ok(result.checks.some((check) => check.includes("청약통장")));
  assert.ok(result.checks.some((check) => check.includes("신혼부부")));
  assert.ok(result.checks.some((check) => check.includes("생애최초")));
  assert.ok(result.checks.every((check) => !check.includes("신청 가능")));
});

test("unknown and negative answers surface basic checks without recommending supply eligibility", () => {
  const result = buildEligibilityCheckResult(["UNKNOWN", "NO", "NO", "UNKNOWN"]);

  assert.equal(result.headline, "신청 전에 확인할 조건이 있어요");
  assert.ok(result.checks.some((check) => check.includes("소유 이력")));
  assert.ok(result.checks.some((check) => check.includes("통장 없이")));
  assert.ok(result.checks.some((check) => check.includes("특별공급 유형별")));
  assert.equal(new Set(result.checks).size, result.checks.length);
});

test("every answer combination produces a non-empty deduplicated checklist", () => {
  const values = ["YES", "NO", "UNKNOWN"];
  for (const homeless of values) {
    for (const account of values) {
      for (const newlywed of values) {
        for (const firstHome of values) {
          const result = buildEligibilityCheckResult([homeless, account, newlywed, firstHome]);
          assert.ok(result.checks.length >= 3);
          assert.equal(new Set(result.checks).size, result.checks.length);
        }
      }
    }
  }
});
