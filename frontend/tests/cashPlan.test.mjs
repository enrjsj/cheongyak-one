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

test('비교 계획은 원본 입력·출처 변경에서 독립적이고 중복·3개 한도를 적용한다', async () => {
  const { captureCashPlan, addCashScenario } = await import('../src/cashPlan.ts');
  const source = { noticeId: 71, title: '검증 공고', unitId: '01', unitName: '84A', publishedPrice: 600000000, syncedAt: '2026-10-05T15:00:00Z' };
  const draft = { ...input };
  const snapshot = captureCashPlan(source, draft, '2026-10-05T15:01:00Z');
  const one = addCashScenario([], snapshot, 1);
  draft.price = '1'; source.title = '변경'; snapshot.input.finalLoan = '0'; snapshot.result.stages[0].ownCash = 1;
  assert.equal(one[0].snapshot.source.title, '검증 공고');
  assert.equal(one[0].snapshot.result.totalCash, 210000000);
  assert.equal(one[0].snapshot.result.stages[0].ownCash, 60000000);
  const equivalent = captureCashPlan(source, { availableCash: input.availableCash, ...input, depositPercent: '10.00' }, '2026-10-06T00:00:00Z');
  assert.throws(() => addCashScenario(one, equivalent, 2), /이미 비교/);
  let plans = one;
  for (const id of [2, 3]) plans = addCashScenario(plans, captureCashPlan(source, { ...input, finalLoan: String(420000000 - id * 10000000) }, snapshot.calculatedAt), id);
  assert.throws(() => addCashScenario(plans, captureCashPlan(source, { ...input, finalLoan: '0' }, snapshot.calculatedAt), 4), /최대 3개/);
  assert.equal(plans.length, 3); assert.equal(one.length, 1);
  const removed = plans.filter(p => p.id !== 2);
  assert.equal(addCashScenario(removed, captureCashPlan(source, { ...input, finalLoan: '0' }, snapshot.calculatedAt), 4).length, 3);
  assert.throws(() => addCashScenario(one, captureCashPlan({ ...source, noticeId: 72 }, input, snapshot.calculatedAt), 2), /같은 공고/);
});

test('텍스트 보고서는 모든 가정·원 단위 결과·출처·한국 시각과 미반영 항목을 담는다', async () => {
  const { captureCashPlan, cashPlanReport } = await import('../src/cashPlan.ts');
  const snapshot = captureCashPlan({ noticeId: 71, title: '서울\n공고\u202e', unitId: '01', unitName: '84A', publishedPrice: 600000000, syncedAt: '2026-10-05T15:00:00Z', officialUrl: 'https://example.com/notice/71', contractStartDate: '2026-10-10' }, input, '2026-10-05T15:01:00Z');
  const report = cashPlanReport([{ id: 1, snapshot }]);
  for (const text of ['210,000,000원', '130,000,000원', '계약금 비율: 10%', '중도금 비율: 60%', '잔금 비율: 30%', '360,000,000원', '420,000,000원', '30,000,000원', '80,000,000원', '공고 최고 금액 사용', '2026. 10. 06.', '한국 시간', 'https://example.com/notice/71', '2026-10-10 ~ 미확인', '회차별 납부일', 'LTV', '서버·AI로 전송되지 않습니다']) assert.ok(report.includes(text), text);
  assert.ok(!report.includes('\u202e')); assert.ok(report.includes('공고: 서울 공고 '));
  assert.throws(() => cashPlanReport([]));
  const unknown = captureCashPlan({ ...snapshot.source, publishedPrice: undefined, syncedAt: 'bad-date', officialUrl: 'javascript:alert(1)' }, input, snapshot.calculatedAt);
  const modified = cashPlanReport([{ id: 2, snapshot: unknown }]);
  assert.ok(modified.includes('공고 최고 공급금액: 미확인')); assert.ok(modified.includes('사용자 입력 금액'));
  assert.ok(modified.includes('공고 수집 시각: 미확인')); assert.ok(modified.includes('공식 공고: 미확인'));
});
