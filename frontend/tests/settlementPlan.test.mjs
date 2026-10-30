import test from "node:test";
import assert from "node:assert/strict";
import { calculateSettlementPlan } from "../src/settlementPlan.ts";

const base = {
  price: 600_000_000, deposit: 60_000_000, interim: 360_000_000,
  balance: 180_000_000, availableCash: 100_000_000,
  interimLoan: 360_000_000, finalLoan: 420_000_000,
};

test("full interim financing preserves cash after the deposit for closing", () => {
  const r = calculateSettlementPlan(base);
  assert.equal(r.contractCosts, 0);
  assert.equal(r.contractDue, 60_000_000);
  assert.equal(r.contractCash, 60_000_000);
  assert.equal(r.contractShortage, 0);
  assert.equal(r.cashAfterContract, 40_000_000);
  assert.equal(r.interimOwnCash, 0);
  assert.equal(r.interimCash, 0);
  assert.equal(r.reservedCash, 40_000_000);
  assert.equal(r.settlementDue, 540_000_000);
  assert.equal(r.requiredFinalLoan, 500_000_000);
  assert.equal(r.finalCashRequired, 120_000_000);
  assert.equal(r.finalCash, 40_000_000);
  assert.equal(r.finalShortage, 80_000_000);
  assert.equal(r.totalAdditionalCash, 80_000_000);
  assert.equal(r.remainingCash, 0);
});

test("without interim financing, cash must also pay the interim amount", () => {
  const r = calculateSettlementPlan({ ...base, interimLoan: 0, finalLoan: 180_000_000 });
  assert.equal(r.interimOwnCash, 360_000_000);
  assert.equal(r.interimCash, 40_000_000);
  assert.equal(r.interimShortage, 320_000_000);
  assert.equal(r.reservedCash, 0);
  assert.equal(r.settlementDue, 180_000_000);
  assert.equal(r.finalShortage, 0);
  assert.equal(r.totalAdditionalCash, 320_000_000);
});

test("partial interim financing pays only the uncovered interim portion in cash", () => {
  const r = calculateSettlementPlan({ ...base, interimLoan: 300_000_000, finalLoan: 420_000_000 });
  assert.equal(r.interimOwnCash, 60_000_000);
  assert.equal(r.interimCash, 40_000_000);
  assert.equal(r.interimShortage, 20_000_000);
  assert.equal(r.settlementDue, 480_000_000);
  assert.equal(r.finalShortage, 60_000_000);
  assert.equal(r.totalAdditionalCash, 80_000_000);
});

test("interim principal is refinanced once rather than omitted or charged twice", () => {
  const r = calculateSettlementPlan({ ...base, finalLoan: 360_000_000 });
  assert.equal(r.settlementDue, base.balance + base.interimLoan);
  assert.equal(r.finalCashRequired, base.balance);
  assert.equal(r.finalShortage, 140_000_000);
  const full = calculateSettlementPlan({ ...base, finalLoan: 540_000_000 });
  assert.equal(full.finalCashRequired, 0);
  assert.equal(full.remainingCash, 40_000_000);
  assert.equal(full.totalAdditionalCash, 0);
});

test("a future final loan cannot cover an earlier contract shortfall", () => {
  const r = calculateSettlementPlan({ ...base, availableCash: 0, finalLoan: 540_000_000 });
  assert.equal(r.contractShortage, 60_000_000);
  assert.equal(r.interimShortage, 0);
  assert.equal(r.finalShortage, 0);
  assert.equal(r.totalAdditionalCash, 60_000_000);
  assert.equal(r.requiredFinalLoan, 540_000_000);
});

test("a future final loan cannot cover an earlier unfunded interim portion", () => {
  const r = calculateSettlementPlan({ ...base, availableCash: 0, interimLoan: 240_000_000, finalLoan: 420_000_000 });
  assert.equal(r.contractShortage, 60_000_000);
  assert.equal(r.interimShortage, 120_000_000);
  assert.equal(r.finalShortage, 0);
  assert.equal(r.totalAdditionalCash, 180_000_000);
});

test("zero final loan requires repayment of the interim principal from cash", () => {
  const r = calculateSettlementPlan({ ...base, finalLoan: 0 });
  assert.equal(r.finalCashRequired, 540_000_000);
  assert.equal(r.finalShortage, 500_000_000);
  assert.equal(r.totalAdditionalCash, 500_000_000);
});

test("cash greater than the price remains cash instead of creating a negative loan need", () => {
  const r = calculateSettlementPlan({ ...base, availableCash: 700_000_000, finalLoan: 0 });
  assert.equal(r.requiredFinalLoan, 0);
  assert.equal(r.totalAdditionalCash, 0);
  assert.equal(r.remainingCash, 100_000_000);
});

test("pre-closing costs use cash before closing while closing costs do not", () => {
  const r = calculateSettlementPlan({ ...base, interimCosts: 50_000_000, settlementCosts: 20_000_000 });
  assert.equal(r.interimOwnCash, 50_000_000);
  assert.equal(r.interimCash, 40_000_000);
  assert.equal(r.interimShortage, 10_000_000);
  assert.equal(r.reservedCash, 0);
  assert.equal(r.settlementDue, 560_000_000);
  assert.equal(r.finalShortage, 140_000_000);
  assert.equal(r.totalAdditionalCash, 150_000_000);
});

test("contract-stage costs can cause an immediate shortage, not a later interim shortage", () => {
  const r = calculateSettlementPlan({ ...base, contractCosts: 50_000_000, finalLoan: 540_000_000 });
  assert.equal(r.contractDue, 110_000_000);
  assert.equal(r.contractCash, 100_000_000);
  assert.equal(r.contractShortage, 10_000_000);
  assert.equal(r.cashAfterContract, 0);
  assert.equal(r.interimShortage, 0);
  assert.equal(r.finalShortage, 0);
  assert.equal(r.totalAdditionalCash, 10_000_000);
});

test("required final loan does not assume that extra costs may be loan financed", () => {
  const r = calculateSettlementPlan({ ...base, availableCash: 0, settlementCosts: 30_000_000, finalLoan: 540_000_000 });
  assert.equal(r.maxFinalLoan, 540_000_000);
  assert.equal(r.requiredFinalLoan, 540_000_000);
  assert.equal(r.finalShortage, 30_000_000);
  assert.equal(r.totalAdditionalCash, 90_000_000);
});

test("zero payment stages and maximum inputs retain exact integer amounts", () => {
  const r = calculateSettlementPlan({
    price: 1_000_000_000_000, deposit: 0, interim: 1_000_000_000_000,
    balance: 0, availableCash: 1_000_000_000_000, interimLoan: 1_000_000_000_000,
    finalLoan: 1_000_000_000_000, interimCosts: 1_000_000_000_000,
    settlementCosts: 1_000_000_000_000, contractCosts: 1_000_000_000_000,
  });
  assert.equal(r.contractCash, 1_000_000_000_000);
  assert.equal(r.interimCash, 0);
  assert.equal(r.interimShortage, 1_000_000_000_000);
  assert.equal(r.settlementDue, 2_000_000_000_000);
  assert.equal(r.finalShortage, 1_000_000_000_000);
  assert.equal(r.totalAdditionalCash, 2_000_000_000_000);
  assert.ok(Object.values(r).every(Number.isSafeInteger));
});

test("cash and all funding sources conserve value across deterministic varied scenarios", () => {
  let state = 127;
  const next = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
  for (let i = 0; i < 500; i++) {
    const price = 1 + next(1_000_000_000);
    const deposit = next(price + 1), interim = next(price - deposit + 1);
    const balance = price - deposit - interim;
    const interimLoan = next(interim + 1), finalLoan = next(balance + interimLoan + 1);
    const availableCash = next(2_000_000_000);
    const contractCosts = next(5_000_000), interimCosts = next(5_000_000), settlementCosts = next(5_000_000);
    const r = calculateSettlementPlan({ price, deposit, interim, balance, availableCash, interimLoan, finalLoan, contractCosts, interimCosts, settlementCosts });
    assert.equal(r.contractCash + r.interimCash + r.finalCash + r.remainingCash, availableCash);
    assert.equal(r.contractCash + r.contractShortage, deposit + contractCosts);
    assert.equal(r.interimCash + r.interimShortage + interimLoan, interim + interimCosts);
    assert.equal(r.finalCash + r.finalShortage + finalLoan, balance + interimLoan + settlementCosts);
    assert.equal(availableCash - r.remainingCash + r.totalAdditionalCash + finalLoan, price + contractCosts + interimCosts + settlementCosts);
    assert.equal(r.totalAdditionalCash, Math.max(price - finalLoan + contractCosts + interimCosts + settlementCosts - availableCash, 0));
    assert.ok(Object.values(r).every(value => Number.isSafeInteger(value) && value >= 0));
  }
});

test("invalid amounts, payment totals and unsupported loan uses are rejected", () => {
  for (const field of ["price", "deposit", "interim", "balance", "availableCash", "interimLoan", "finalLoan", "contractCosts", "interimCosts", "settlementCosts"]) {
    for (const value of [-1, 0.1, 1_000_000_000_001, NaN, Infinity, "100", null]) {
      assert.throws(() => calculateSettlementPlan({ ...base, [field]: value }), `${field}: ${value}`);
    }
  }
  assert.throws(() => calculateSettlementPlan({ ...base, price: 0, deposit: 0, interim: 0, balance: 0, interimLoan: 0, finalLoan: 0 }));
  assert.throws(() => calculateSettlementPlan({ ...base, balance: base.balance - 1 }));
  assert.throws(() => calculateSettlementPlan({ ...base, interimLoan: base.interim + 1 }));
  assert.throws(() => calculateSettlementPlan({ ...base, finalLoan: base.balance + base.interimLoan + 1 }));
  assert.throws(() => calculateSettlementPlan({ ...base, interimLoan: 0, finalLoan: base.balance + 1 }));
});
