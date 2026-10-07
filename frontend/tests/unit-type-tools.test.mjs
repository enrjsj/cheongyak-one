import test from "node:test";
import assert from "node:assert/strict";
import { sortUnitTypes, unitDifference, unitValue } from "../src/unitTypeTools.ts";

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
