import test from 'node:test';
import assert from 'node:assert/strict';
import { noticeQualityItems } from '../src/noticeQuality.ts';

const valid = { businessEntityName: '기관', housingCategory: 'APARTMENT', applyStartDate: '2028-02-29', applyEndDate: '2028-03-01', minPrice: 0, maxPrice: 100, unitTypes: [{}] };
const codes = data => noticeQualityItems(data).map(item => item.code);
test('정상 응답과 0원은 확인 항목을 만들지 않으며 원본을 변경하지 않는다', () => {
  const source = structuredClone(valid), before = structuredClone(source);
  assert.deepEqual(noticeQualityItems(source), []);
  assert.deepEqual(source, before);
});
test('누락과 Unicode 공백을 미제공으로 분류한다', () => {
  const items = noticeQualityItems({ housingCategory: 'APARTMENT', businessEntityName: '\u3000\u00a0' });
  assert.deepEqual(items.map(item => item.code), ['supplier', 'period-missing', 'price-missing', 'units']);
  assert.ok(items.every(item => item.kind === '미제공'));
});
test('존재하지 않는 날짜와 역전 기간을 확인 필요로 분류한다', () => {
  for (const [start, end] of [['2027-02-29', '2027-03-01'], ['2026-13-01', '2027-01-01'], ['2026-03-02', '2026-03-01'], ['invalid', '2026-03-01']]) {
    assert.deepEqual(codes({ ...valid, applyStartDate: start, applyEndDate: end }), ['period-invalid']);
  }
});
test('누락·음수·비유한 금액·역전 범위를 구별한다', () => {
  assert.deepEqual(codes({ ...valid, minPrice: null }), ['price-missing']);
  for (const minPrice of [-1, NaN, Infinity, 101]) assert.deepEqual(codes({ ...valid, minPrice }), ['price-invalid']);
});
test('공공임대는 분양 주택형 누락을 경고하지 않는다', () => {
  assert.deepEqual(codes({ ...valid, housingCategory: 'PUBLIC_RENTAL', unitTypes: [] }), []);
  assert.match(noticeQualityItems({ ...valid, housingCategory: 'PUBLIC_RENTAL', minPrice: null })[0].message, /임대보증금/);
});
