import test from "node:test";
import assert from "node:assert/strict";
import { sortUnitTypes, unitDifference, unitValue, unitQualityItems } from "../src/unitTypeTools.ts";

const completeUnit = { supplyArea: 59.9, maxPrice: 0, generalSupplyCount: 0, specialSupplyCount: 0, totalSupplyCount: 0 };
test("주택형 확인 안내는 정상 소수 면적과 0원·0세대를 보존하고 원본을 바꾸지 않는다", () => {
  const units = [structuredClone(completeUnit)], before = structuredClone(units);
  assert.deepEqual(unitQualityItems(units), []);
  assert.deepEqual(unitQualityItems([]), []);
  assert.deepEqual(units, before);
});
test("주택형 일부 누락은 전체 행 수와 필드별 누락 수를 구분한다", () => {
  const items = unitQualityItems([completeUnit, { ...completeUnit, maxPrice: null }, { ...completeUnit, maxPrice: undefined, supplyArea: null }]);
  assert.deepEqual(items.map(item => item.code), ['units-supplyArea-missing', 'units-maxPrice-missing']);
  assert.match(items[0].message, /3개 중 1개/);
  assert.match(items[1].message, /3개 중 2개/);
  assert.ok(items.every(item => item.kind === '미제공'));
});
test("잘못된 주택형 수치는 누락과 별도로 집계하고 필드마다 기존 표시 검증을 따른다", () => {
  for (const field of ['supplyArea', 'maxPrice', 'generalSupplyCount', 'specialSupplyCount', 'totalSupplyCount']) {
    const invalid = field === 'supplyArea' ? [0, -1, NaN, Infinity, '59'] : [-1, NaN, Infinity, '1', 0.5, Number.MAX_SAFE_INTEGER + 1];
    for (const value of invalid) {
      const items = unitQualityItems([{ ...completeUnit, [field]: null }, { ...completeUnit, [field]: value }]);
      assert.deepEqual(items.map(item => [item.code, item.kind]), [[`units-${field}-missing`, '미제공'], [`units-${field}-invalid`, '확인 필요']]);
      assert.ok(items.every(item => /2개 중 1개/.test(item.message)));
    }
  }
});
test("많은 주택형도 행마다 경고를 늘리지 않고 공급 세대를 추정하지 않는다", () => {
  const items = unitQualityItems(Array.from({ length: 100 }, () => ({ ...completeUnit, totalSupplyCount: undefined })));
  assert.equal(items.length, 1);
  assert.match(items[0].message, /100개 중 100개의 전체 공급 세대/);
});

test("numeric unit sorting preserves ties and the API order, with unknown values last in both directions", () => {
  const units = [{ modelId: "unknown" }, { modelId: "a", maxPrice: 500000000 }, { modelId: "b", maxPrice: 100000000 }, { modelId: "tie", maxPrice: 500000000 }, { modelId: "null", maxPrice: null }];
  const ids = sort => sortUnitTypes(units, sort).map(unit => unit.modelId);
  assert.deepEqual(ids("PRICE_ASC"), ["b", "a", "tie", "unknown", "null"]);
  assert.deepEqual(ids("PRICE_DESC"), ["a", "tie", "b", "unknown", "null"]);
  assert.deepEqual(ids("ORIGINAL"), ["unknown", "a", "b", "tie", "null"]);
  assert.notEqual(sortUnitTypes(units, "ORIGINAL"), units);
});

test("decimal area and integer supply ordering distinguish real zero from invalid values", () => {
  const units = [{ modelId: "a", supplyArea: 84.12, totalSupplyCount: 0 }, { modelId: "b", supplyArea: 59.9, totalSupplyCount: 12 }, { modelId: "c", supplyArea: 0, totalSupplyCount: -1 }];
  assert.deepEqual(sortUnitTypes(units, "AREA_ASC").map(u => u.modelId), ["b", "a", "c"]);
  assert.deepEqual(sortUnitTypes(units, "AREA_DESC").map(u => u.modelId), ["a", "b", "c"]);
  assert.deepEqual(sortUnitTypes(units, "SUPPLY_DESC").map(u => u.modelId), ["b", "a", "c"]);
  for (const value of [undefined, null, NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, "12"]) assert.equal(unitValue({ maxPrice: value }, "maxPrice"), undefined);
  assert.equal(unitValue({ generalSupplyCount: 0 }, "generalSupplyCount"), 0);
});

test("comparison uses exact won and rounded square meters, never infers a missing baseline", () => {
  const baseline = { maxPrice: 712345678, supplyArea: 84.12, totalSupplyCount: 10 };
  const other = { maxPrice: 712345679, supplyArea: 84.13, totalSupplyCount: 0 };
  assert.equal(unitDifference(other, baseline, "maxPrice"), 1);
  assert.equal(unitDifference(baseline, other, "maxPrice"), -1);
  assert.equal(unitDifference(other, baseline, "supplyArea"), 0.01);
  assert.equal(unitDifference(other, baseline, "totalSupplyCount"), -10);
  assert.equal(unitDifference(other, {}, "maxPrice"), undefined);
  assert.equal(unitDifference({}, baseline, "maxPrice"), undefined);
  assert.equal(unitDifference(baseline, baseline, "maxPrice"), 0);
});
