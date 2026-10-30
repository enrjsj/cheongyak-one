import test from "node:test";
import assert from "node:assert/strict";
import { calculateLoanEstimate } from "../src/loanEstimate.ts";

const base = { principal: 300_000_000, annualRate: 4.5, years: 30, method: "annuity" };

test("annuity matches an independently calculated 300m won, 4.5%, 30-year example", () => {
  // Decimal(50-digit precision): payment=1520055.929477642,
  // lifetime interest=247220134.611951147 before display rounding.
  assert.deepEqual(calculateLoanEstimate(base), {
    firstPayment: 1_520_056, lastPayment: 1_520_056,
    firstInterest: 1_125_000, firstPrincipal: 395_056,
    totalInterest: 247_220_135, totalPayment: 547_220_135, months: 360,
  });
});

test("one-year annuity has the independently calculated total interest", () => {
  const result = calculateLoanEstimate({ ...base, principal: 100_000_000, annualRate: 12, years: 1 });
  assert.equal(result.firstPayment, 8_884_879);
  assert.equal(result.lastPayment, result.firstPayment);
  assert.equal(result.totalInterest, 6_618_546);
  assert.equal(result.totalPayment, 106_618_546);
});

test("equal principal shows declining payments and arithmetic-series interest", () => {
  const result = calculateLoanEstimate({ principal: 120_000_000, annualRate: 12, years: 1, method: "equalPrincipal" });
  assert.deepEqual(result, {
    firstPayment: 11_200_000, lastPayment: 10_100_000,
    firstPrincipal: 10_000_000, firstInterest: 1_200_000,
    totalInterest: 7_800_000, totalPayment: 127_800_000, months: 12,
  });
});

test("zero interest spreads principal without inventing interest for either method", () => {
  for (const method of ["annuity", "equalPrincipal"]) {
    assert.deepEqual(calculateLoanEstimate({ principal: 120_000_000, annualRate: 0, years: 10, method }), {
      firstPayment: 1_000_000, lastPayment: 1_000_000,
      firstPrincipal: 1_000_000, firstInterest: 0,
      totalInterest: 0, totalPayment: 120_000_000, months: 120,
    });
  }
});

test("zero principal remains zero even with maximum rate and term", () => {
  for (const method of ["annuity", "equalPrincipal"]) {
    const result = calculateLoanEstimate({ principal: 0, annualRate: 30, years: 50, method });
    assert.equal(result.months, 600);
    for (const [key, value] of Object.entries(result)) if (key !== "months") assert.equal(value, 0);
  }
});

test("long high-interest annuity does not accumulate a spurious final balance", () => {
  // Independent Decimal(50-digit) oracle at the largest accepted inputs.
  const result = calculateLoanEstimate({ principal: 1_000_000_000_000, annualRate: 30, years: 50, method: "annuity" });
  assert.equal(result.firstPayment, 25_000_009_196);
  assert.equal(result.lastPayment, result.firstPayment);
  assert.equal(result.totalInterest, 14_000_005_517_879);
  assert.equal(result.totalPayment, 15_000_005_517_879);
});

test("tiny rates stay stable, outputs remain finite and totals conserve principal", () => {
  for (const annualRate of [Number.MIN_VALUE, 0.000000001, 0.01, 4.5, 30]) {
    for (const method of ["annuity", "equalPrincipal"]) {
      const result = calculateLoanEstimate({ ...base, annualRate, method });
      assert.equal(result.totalPayment - result.totalInterest, base.principal);
      assert.ok(Object.values(result).every(value => Number.isSafeInteger(value) && value >= 0));
      assert.ok(result.firstPayment >= result.lastPayment);
    }
  }
});

test("a higher rate costs more and equal-principal costs less interest for the same terms", () => {
  const annuity = calculateLoanEstimate(base);
  const stressed = calculateLoanEstimate({ ...base, annualRate: 5.5 });
  const equal = calculateLoanEstimate({ ...base, method: "equalPrincipal" });
  assert.ok(stressed.firstPayment > annuity.firstPayment);
  assert.ok(stressed.totalInterest > annuity.totalInterest);
  assert.ok(equal.firstPayment > annuity.firstPayment);
  assert.ok(equal.totalInterest < annuity.totalInterest);
  assert.equal(annuity.totalPayment, base.principal + annuity.totalInterest);
});

test("invalid, non-finite and unsupported loan assumptions are rejected", () => {
  for (const principal of [-1, 0.5, 1_000_000_000_001, NaN, Infinity, "100"]) {
    assert.throws(() => calculateLoanEstimate({ ...base, principal }));
  }
  for (const annualRate of [-0.01, 30.01, NaN, Infinity, "4.5"]) {
    assert.throws(() => calculateLoanEstimate({ ...base, annualRate }));
  }
  for (const years of [0, 51, 1.5, NaN, Infinity, "30"]) {
    assert.throws(() => calculateLoanEstimate({ ...base, years }));
  }
  assert.throws(() => calculateLoanEstimate({ ...base, method: "interestOnly" }));
});

