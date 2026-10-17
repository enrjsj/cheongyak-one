import test from "node:test";
import assert from "node:assert/strict";
import { csvCell } from "../src/fileExport.ts";
import { buildNoticeCalendar, hasNoticeCalendarEvents } from "../src/noticeTools.ts";

test("CSV formula prefixes stay literal, including whitespace and control prefixes", () => {
  for (const value of ["=1+1", "+1", "-1", "@SUM(A1)", " \t=1", "\uFEFF=1", "\u0000=1"]) {
    assert.equal(csvCell(value), `"'${value}"`);
  }
});
test("CSV preserves Korean, commas, quotes and multiline memo content", () => {
  assert.equal(csvCell('서울, "메모"\n확인'), '"서울, ""메모""\n확인"');
  assert.equal(csvCell("0"), '"0"');
  assert.equal(csvCell(""), '""');
});
test("calendar availability shares the event generator's strict date policy", () => {
  for (const dates of [{}, { applyStartDate: "bad" }, { applyEndDate: "2026-02-30" },
    { applyStartDate: "2026-10-30", applyEndDate: "2026-10-01" }]) {
    const notices = [{ id: 1, title: "공고", ...dates }];
    assert.equal(hasNoticeCalendarEvents(notices), false);
    assert.ok(!buildNoticeCalendar(notices).includes("BEGIN:VEVENT"));
  }
});
test("a valid announcement survives a reversed application period", () => {
  const notices = [{ id: 1, title: "공고", applyStartDate: "2026-10-30", applyEndDate: "2026-10-01", winnerAnnounceDate: "2026-11-01" }];
  assert.equal(hasNoticeCalendarEvents(notices), true);
  assert.equal(buildNoticeCalendar(notices).match(/BEGIN:VEVENT/g).length, 1);
});
