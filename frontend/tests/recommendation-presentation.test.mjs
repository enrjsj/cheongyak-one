import assert from "node:assert/strict";
import test from "node:test";
import { recommendationCriteria, recommendationNoticePresentation } from "../src/recommendationPresentation.ts";

const updatedAt = "2026-11-02T01:00:00Z";
const preference = { region: "서울", housingCategory: "APARTMENT", supplyType: "SALE", status: "OPEN", sort: "LATEST", updatedAt };
const notice = { id: 1, sourceSystem: "REB_APARTMENT", housingCategory: "APARTMENT", status: "UPCOMING", title: "예시 공고", syncedAt: updatedAt };

test("recommendation criteria describe the saved version including zero and one-sided bounds", () => {
  assert.deepEqual(recommendationCriteria({ ...preference, minPriceManwon: 0, maxPriceManwon: 50000, maxArea: 85 }, updatedAt), [
    "서울", "아파트", "분양", "접수중", "공고 금액 0만원 ~ 50,000만원", "공급면적 85㎡ 이하",
  ]);
  assert.deepEqual(recommendationCriteria({ status: "ALL", sort: "LATEST", updatedAt }, updatedAt), ["전국", "전체 주택유형", "분양·임대", "접수중·접수 예정"]);
});

test("missing or mismatched preference versions must not claim that the current criteria were applied", () => {
  assert.equal(recommendationCriteria(preference, undefined), undefined);
  assert.equal(recommendationCriteria(undefined, updatedAt), undefined);
  assert.equal(recommendationCriteria(preference, "2026-11-01T01:00:00Z"), undefined);
});

test("recommendation amount distinguishes rental deposit, zero and unavailable prices", () => {
  assert.match(recommendationNoticePresentation(notice).price, /분양가는 공고문 확인/);
  assert.match(recommendationNoticePresentation({ ...notice, housingCategory: "PUBLIC_RENTAL", minPrice: 0, maxPrice: 50000000 }).price, /임대보증금 0만원 — 5,000만원/);
  assert.match(recommendationNoticePresentation({ ...notice, rentType: "민간임대", maxPrice: 100000000 }).price, /공고 금액 최대 1억 · 최소 미확인/);
  assert.match(recommendationNoticePresentation({ ...notice, minPrice: 500000000, maxPrice: 100000000 }).price, /공고문 확인/);
});

test("recommendation dates retain year and do not replace missing application dates with the winner announcement", () => {
  assert.equal(recommendationNoticePresentation({ ...notice, applyStartDate: "2026-12-31", applyEndDate: "2027-01-02" }).period, "2026-12-31 ~ 2027-01-02");
  assert.equal(recommendationNoticePresentation({ ...notice, winnerAnnounceDate: "2026-11-20" }).period, "접수 일정 미확인");
  assert.equal(recommendationNoticePresentation({ ...notice, applyEndDate: "2026-11-20" }).period, "시작일 미확인 · 2026-11-20 마감");
  assert.equal(recommendationNoticePresentation({ ...notice, applyStartDate: "2026-11-20", applyEndDate: "2026-11-19" }).period, "접수 일정 확인 필요");
  assert.equal(recommendationNoticePresentation({ ...notice, applyStartDate: "2026-02-30" }).period, "접수 일정 미확인");
});

test("supply area only uses available positive measurements and preserves unknown or invalid ranges", () => {
  assert.equal(recommendationNoticePresentation(notice).area, "미확인");
  assert.equal(recommendationNoticePresentation({ ...notice, minArea: 59.5, maxArea: 84 }).area, "59.5㎡ ~ 84㎡");
  assert.equal(recommendationNoticePresentation({ ...notice, maxArea: 84 }).area, "84㎡ 이하");
  for (const values of [{ minArea: 0 }, { minArea: NaN }, { minArea: 85, maxArea: 84 }]) {
    assert.equal(recommendationNoticePresentation({ ...notice, ...values }).area, "범위 확인 필요");
  }
});
