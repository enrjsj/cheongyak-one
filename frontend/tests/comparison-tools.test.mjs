import test from "node:test";
import assert from "node:assert/strict";
import { comparisonCsv, comparisonRows, safeOfficialUrl, selectComparisonRows } from "../src/comparisonTools.ts";
const item = { id: 1, title: "서울", category: "아파트", region: "서울", location: "강남", state: "접수중", dday: "D-1", period: "10.1~10.2", winnerDate: "10.10", price: "5억", scale: "100세대", officialUrl: "https://example.com/1" };
test("comparison rows distinguish displayed differences without changing input", () => {
  const items = [item, { ...item, id: 2, price: "6억" }]; const before = structuredClone(items);
  const rows = comparisonRows(items);
  assert.equal(rows.length, 7); assert.deepEqual(rows.filter(row => row.different).map(row => row.key), ["price"]);
  assert.deepEqual(items, before);
});
test("comparison group and difference filters compose", () => {
  const rows = comparisonRows([item, { ...item, id: 2, price: "6억" }]);
  assert.equal(selectComparisonRows(rows, "SCHEDULE", false).length, 3);
  assert.equal(selectComparisonRows(rows, "BASIC", true).length, 0);
  assert.deepEqual(selectComparisonRows(rows, "COST", true).map(row => row.key), ["price"]);
  assert.equal(selectComparisonRows(rows, "ALL", false).length, 7);
});
test("comparison missing values are explicit and not ranked", () => {
  const rows = comparisonRows([{ ...item, price: " " }, { ...item, id: 2, price: "" }]);
  const row = rows.find(row => row.key === "price");
  assert.deepEqual(row.values, ["정보 미제공", "정보 미제공"]); assert.equal(row.different, false);
});
test("comparison CSV keeps visible rows and quotes multiline text", () => {
  const items = [{ ...item, title: '서울,"단지"\n이름' }, { ...item, id: 2 }];
  const rows = selectComparisonRows(comparisonRows(items), "COST", false);
  const csv = comparisonCsv(items, rows);
  assert.ok(csv.startsWith('\uFEFF"비교 항목"')); assert.ok(csv.includes('"서울,""단지""\n이름"'));
  assert.ok(csv.includes('"가격·보증금"')); assert.ok(!csv.includes('"당첨 발표"')); assert.ok(csv.includes('"공식 공고"'));
});
test("comparison CSV neutralizes formula-like cells", () => {
  for (const title of ["=1+1", "+1", "-1", "@SUM(A1)", " \t=1", "\n=1", "\uFEFF=1"]) {
    assert.ok(comparisonCsv([{ ...item, title }], []).includes('"\'' + title + '"'));
  }
});
test("official links reject executable schemes, relative paths and credentials", () => {
  for (const url of [undefined, "javascript:alert(1)", "data:text/html,test", "/relative", "https://user:pass@example.com"]) assert.equal(safeOfficialUrl(url), undefined);
  assert.equal(safeOfficialUrl("https://example.com/a"), "https://example.com/a");
});
