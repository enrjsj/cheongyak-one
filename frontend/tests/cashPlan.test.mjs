import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCashPlan, sourcePrice, emptyCashPlan } from '../src/cashPlan.ts';
const input = { price: '600000000', depositPercent: '10', interimPercent: '60', interimLoan: '360000000', finalLoan: '420000000', extras: '30000000', availableCash: '80000000' };

test('중도금 대출 상환을 포함한 단계별 자기자금과 누적 부족액', () => {
  const r = calculateCashPlan(input);
  assert.equal(r.deposit, 60000000); assert.equal(r.interim, 360000000); assert.equal(r.balance, 180000000);
  assert.deepEqual(r.stages.map(s => s.ownCash), [60000000, 0, 150000000]);
  assert.deepEqual(r.stages.map(s => s.shortage), [0, 0, 130000000]);
  assert.equal(r.totalCash, 210000000);
});
test('대출이 없는 계획은 전체 공급금액과 추가 비용을 자기자금으로 준비한다', () => {
  const r = calculateCashPlan({ ...input, interimLoan: '0', finalLoan: '0', extras: '0', availableCash: '600000000' });
  assert.equal(r.totalCash, 600000000); assert.deepEqual(r.stages.map(s => s.shortage), [0, 0, 0]);
});
test('비율 반올림 잔여분은 잔금으로 보존하고 최대 금액에서도 정밀도를 유지한다', () => {
  for (const price of ['1', '600000001', '999999999999', '1000000000000']) {
    const r = calculateCashPlan({ ...input, price, depositPercent: '33.33', interimPercent: '33.33', interimLoan: '0', finalLoan: '0', extras: '0' });
    assert.equal(r.deposit + r.interim + r.balance, Number(price));
    assert.equal(r.totalCash, Number(price));
  }
  assert.equal(calculateCashPlan({ ...input, price: '999999999999', depositPercent: '33.33', interimPercent: '33.33', interimLoan: '0', finalLoan: '0' }).deposit, 333299999999);
});
test('빈 값, 음수, 소수 원, 지수표기, 무한대와 허용 범위를 넘어선 입력은 계산하지 않는다', () => {
  assert.throws(() => calculateCashPlan(emptyCashPlan()));
  for (const key of Object.keys(input)) assert.throws(() => calculateCashPlan({ ...input, [key]: '' }), key);
  for (const value of ['-1', '1.5', '1e8', 'Infinity', 'NaN', '1,000', '1000000000001', ' 100']) assert.throws(() => calculateCashPlan({ ...input, extras: value }), value);
  for (const value of ['-1', '100.01', '1.001', '1e1', 'NaN']) assert.throws(() => calculateCashPlan({ ...input, depositPercent: value }), value);
  assert.throws(() => calculateCashPlan({ ...input, price: '0' }));
});
test('비율 합과 단계별 대출 상한을 검증하고 이미 납부한 현금 환급은 허용하지 않는다', () => {
  assert.throws(() => calculateCashPlan({ ...input, depositPercent: '41' }), /100%/);
  assert.throws(() => calculateCashPlan({ ...input, interimLoan: '360000001' }), /중도금보다/);
  assert.throws(() => calculateCashPlan({ ...input, finalLoan: '540000001' }), /상환액/);
  const r = calculateCashPlan({ ...input, finalLoan: '540000000', extras: '0' });
  assert.equal(r.stages[2].ownCash, 0); assert.equal(r.totalCash, 60000000);
});
test('누락·잘못된 공고 금액을 0원이나 반올림한 금액으로 자동 적용하지 않는다', () => {
  for (const value of [undefined, null, 0, -1, 1.1, Infinity, NaN, 1000000000001]) assert.equal(sourcePrice(value), '');
  assert.equal(sourcePrice(600000000), '600000000');
});
