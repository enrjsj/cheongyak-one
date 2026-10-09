import assert from "node:assert/strict";
import test from "node:test";
import { dateValue, daysBetween, formatShortDate, formatPeriod, optionalPeriod, formatChangedAt, weekday, statusPresentation, toApplication } from "../src/noticePresentation.ts";

test("calendar dates reject impossible or non-canonical input without NaN", () => {
  for (const date of [undefined, null, "", "bad", "2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "2026-1-01", "2026-10-09T00:00:00Z"]) {
    assert.equal(dateValue(date), undefined);
    assert.equal(formatShortDate(date), "일정 미정");
    assert.equal(weekday(date), "");
    assert.equal(daysBetween("2026-10-09", date), undefined);
  }
  assert.equal(daysBetween("bad", "2026-10-09"), undefined);
});

test("valid dates preserve leap days, short years and UTC calendar arithmetic", () => {
  assert.equal(formatShortDate("2028-02-29"), "2. 29.");
  assert.equal(weekday("2026-10-09"), "금");
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(new Date(dateValue("0099-01-01")).getUTCFullYear(), 99);
});

test("application periods retain a known end date and avoid reversed ranges", () => {
  assert.equal(formatPeriod(undefined, "2026-10-09", "2026-10-20"), "10. 9. 접수 마감");
  assert.equal(formatPeriod("bad", "2026-10-09"), "10. 9. 접수 마감");
  assert.equal(formatPeriod("2026-10-09", undefined), "10. 9. 접수 시작");
  assert.equal(formatPeriod("2026-10-09", "2026-10-10"), "10. 9. — 10. 10.");
  assert.equal(formatPeriod("2026-10-10", "2026-10-09"), "접수 일정은 공고문 확인");
  assert.equal(formatPeriod(undefined, undefined, "2026-10-20"), "당첨 발표 10. 20.");
  assert.equal(formatPeriod("bad", "2026-02-30", "bad"), "세부 일정은 공고문 확인");
});

test("optional periods preserve partial valid dates and flag invalid or reversed data", () => {
  assert.equal(optionalPeriod(), "일정 미정");
  assert.equal(optionalPeriod("2026-10-09"), "10. 9.부터");
  assert.equal(optionalPeriod(undefined, "2026-10-09"), "10. 9.까지");
  assert.equal(optionalPeriod("2026-10-09", "2026-10-10"), "10. 9. — 10. 10.");
  assert.equal(optionalPeriod("2026-02-30", "2026-03-02"), "일정 확인 필요");
  assert.equal(optionalPeriod("2026-10-10", "2026-10-09"), "일정 확인 필요");
});

test("malformed change timestamps use a fallback instead of throwing during render", () => {
  for (const value of ["", "bad", "2026-99-99T00:00:00Z"]) {
    assert.equal(formatChangedAt(value), "변경 시각 미확인");
  }
  assert.match(formatChangedAt("2026-10-09T00:00:00Z"), /10월 9일/);
});

test("today deadline labels never override closed, announced or upcoming state", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-08T15:01:00Z") });
  assert.equal(statusPresentation("OPEN", "2026-10-09").state, "오늘 마감");
  assert.equal(statusPresentation("OPEN", "2026-10-10").state, "접수중");
  assert.equal(statusPresentation("CLOSED", "2026-10-09").state, "접수 마감");
  assert.equal(statusPresentation("ANNOUNCED", "2026-10-09").state, "당첨 발표");
  assert.equal(statusPresentation("UPCOMING", "2026-10-09").state, "오픈 예정");
});

test("invalid deadlines become unknown instead of a fabricated closed countdown", () => {
  const result = toApplication({ id: 1, title: "일정 미확인", sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", applyEndDate: "2026-02-30", syncedAt: "2026-10-09T00:00:00Z" });
  assert.equal(result.dday, "일정 확인");
  assert.equal(result.period, "세부 일정은 공고문 확인");
});
