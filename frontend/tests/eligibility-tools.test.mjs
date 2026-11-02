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
          assert.equal(new Set(result.items.map(item => item.id)).size, result.items.length);
          assert.deepEqual(result.checks, result.items.map(item => item.title));
          assert.equal(result.answeredCount, 4);
          assert.equal(result.unknownCount, [homeless, account, newlywed, firstHome].filter(answer => answer === "UNKNOWN").length);
          for (const item of result.items) {
            assert.ok(item.reason && item.evidence && item.action, item.id);
            assert.ok(["FIRST", "NOTICE"].includes(item.priority));
          }
        }
      }
    }
  }
});

test("not considering special supply is not a basic eligibility concern", () => {
  const result = buildEligibilityCheckResult(["YES", "YES", "NO", "NO"]);
  assert.equal(result.headline, "공고별 세부 조건을 확인해 주세요");
  assert.ok(result.items.every(item => item.priority === "NOTICE"));
  assert.ok(!result.items.some(item => ["newlywed", "firstHome", "supplyRoute"].includes(item.id)));
  assert.ok(result.items.some(item => item.id === "residence"));
  assert.ok(result.items.some(item => item.id === "restrictions"));
});

test("ownership and account gaps get actionable first checks without exclusion verdicts", () => {
  const result = buildEligibilityCheckResult(["NO", "NO", "NO", "NO"]);
  assert.deepEqual(result.items.filter(item => item.priority === "FIRST").map(item => item.id), ["household", "account"]);
  assert.match(result.items[0].reason, /신청 불가를 정하지/);
  assert.match(result.items[0].action, /예외/);
  assert.match(result.items[1].reason, /지금 가입해도/);
  assert.match(result.items[1].evidence, /가입일/);
});

test("unknown supply interest appears before notice comparison without duplicate tasks", () => {
  const result = buildEligibilityCheckResult(["YES", "YES", "UNKNOWN", "UNKNOWN"]);
  assert.equal(result.items[0].id, "supplyRoute");
  assert.equal(result.items.filter(item => item.id === "supplyRoute").length, 1);
  assert.equal(result.unknownCount, 2);
  assert.match(result.items[0].reason, /자격 충족 여부로 판단하지/);
});

test("selected interests include their own evidence and do not imply qualification", () => {
  const result = buildEligibilityCheckResult(["YES", "YES", "YES", "YES"]);
  assert.match(result.items.find(item => item.id === "newlywed").action, /공고에 신혼부부 공급이 있는지/);
  assert.match(result.items.find(item => item.id === "firstHome").evidence, /과거 주택 소유/);
  assert.match(result.items.find(item => item.id === "restrictions").reason, /조회하지 않았어요/);
  assert.match(result.items.find(item => item.id === "residence").reason, /선호 지역/);
});

test("missing and malformed answers remain unverified and extra answers have no effect", () => {
  const empty = buildEligibilityCheckResult([]);
  assert.equal(empty.answeredCount, 0);
  assert.equal(empty.unknownCount, 4);
  assert.deepEqual(empty.items.filter(item => item.priority === "FIRST").map(item => item.id), ["household", "account", "supplyRoute"]);
  const partial = buildEligibilityCheckResult(["YES", undefined, "INVALID", "NO"]);
  assert.equal(partial.answeredCount, 2);
  assert.equal(partial.unknownCount, 2);
  assert.deepEqual(partial.items.filter(item => item.priority === "FIRST").map(item => item.id), ["account", "supplyRoute"]);
  assert.deepEqual(buildEligibilityCheckResult(["YES", "YES", "NO", "NO", "UNKNOWN"]), buildEligibilityCheckResult(["YES", "YES", "NO", "NO"]));
});
