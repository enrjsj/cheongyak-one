import test from "node:test";
import assert from "node:assert/strict";
import { hasUnitRange, unitMatchesRange } from "../src/unitTypeMatching.ts";

test("price and area must match one unit instead of different rows", () => {
  const units = [{ supplyArea: 59, maxPrice: 300000000 }, { supplyArea: 84, maxPrice: 700000000 }];
  const range = { maxPrice: 400000000, minArea: 80 };
  assert.equal(hasUnitRange(range), true);
  assert.deepEqual(units.filter(unit => unitMatchesRange(unit, range)), []);
  assert.equal(unitMatchesRange({ supplyArea: 84, maxPrice: 400000000 }, range), true);
});

test("range boundaries include exact prices and decimal areas", () => {
  const unit = { supplyArea: 84.5, maxPrice: 550000000 };
  assert.equal(unitMatchesRange(unit, { minPrice: 550000000, maxPrice: 550000000, minArea: 84.5, maxArea: 84.5 }), true);
  assert.equal(unitMatchesRange(unit, { maxArea: 84 }), false);
  assert.equal(unitMatchesRange(unit, { minPrice: 600000000, maxPrice: 500000000 }), false);
});

test("unknown values cannot satisfy bounds but do not block unrelated filters", () => {
  assert.equal(hasUnitRange({}), false);
  assert.equal(unitMatchesRange({}, {}), true);
  assert.equal(unitMatchesRange({ supplyArea: 84, maxPrice: null }, { maxPrice: 600000000, minArea: 80 }), false);
  assert.equal(unitMatchesRange({ supplyArea: null, maxPrice: 550000000 }, { minArea: 80 }), false);
  assert.equal(unitMatchesRange({ supplyArea: 84 }, { minArea: 80 }), true);
  assert.equal(unitMatchesRange({ maxPrice: 0 }, { minPrice: 0, maxPrice: 0 }), true);
});
