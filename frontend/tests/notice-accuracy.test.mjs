import assert from 'node:assert/strict';
import test from 'node:test';
import { isRentalNotice, noticePriceLabel } from '../src/noticeSupply.ts';
import { toApplication, formatWon } from '../src/noticePresentation.ts';
import { toComparisonItem, comparisonRows, comparisonCsv } from '../src/comparisonTools.ts';
import { unitMatchesRange } from '../src/unitTypeMatching.ts';
import { noticeQualityItems } from '../src/noticeQuality.ts';
import { recentSearchLabel } from '../src/recentSearchTools.ts';

test('rental supply labels do not claim private rentals are public housing', () => {
  assert.equal(recentSearchLabel({ supplyType: 'PUBLIC_RENTAL', status: 'all', sort: 'LATEST' }), '임대 공급');
  assert.equal(recentSearchLabel({ category: 'PUBLIC_RENTAL', status: 'all', sort: 'LATEST' }), '공공임대');
});

const notice = { id: 1, title: '공고', housingCategory: 'APARTMENT', sourceSystem: 'REB_APT', status: 'OPEN',
  minPrice: 601000000, maxPrice: 601000000, applyStartDate: '2026-10-20', applyEndDate: '2026-10-21', winnerAnnounceDate: '2026-11-01' };

test('rental metadata is shared, never inferred from title or housing detail type', () => {
  for (const housingCategory of ['APARTMENT', 'OFFICETEL']) {
    const rental = { ...notice, housingCategory, rentType: ' 분양전환 가능임대 ' };
    assert.equal(isRentalNotice(rental), true);
    assert.equal(noticePriceLabel(rental), '공고 금액');
    assert.match(toApplication(rental).price, /^공고 금액 /);
    assert.match(toApplication(rental).deposit, /월 임대료/);
    assert.equal(noticeQualityItems(rental).some(item => item.code === 'units'), false);
  }
  for (const rentType of [undefined, null, '', '분양주택']) {
    assert.equal(isRentalNotice({ ...notice, rentType, title: '임대주택', housingDetailType: '임대' }), false);
  }
  assert.equal(noticePriceLabel({ ...notice, housingCategory: 'PUBLIC_RENTAL' }), '임대보증금');
});

test('partial prices preserve known maximum and valid zero without trusting invalid numbers', () => {
  assert.equal(toApplication({ ...notice, minPrice: null, maxPrice: 600000000 }).price, '분양가 최대 6억 · 최소 미확인');
  assert.equal(toApplication({ ...notice, minPrice: null, maxPrice: 0 }).price, '분양가 최대 0만원 · 최소 미확인');
  for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) assert.equal(formatWon(value), undefined);
});

test('comparison and CSV preserve exact won and full calendar years', () => {
  const items = [notice, { ...notice, id: 2, minPrice: 604000000, maxPrice: 604000000,
    applyStartDate: '2027-10-20', applyEndDate: '2027-10-21', winnerAnnounceDate: '2027-11-01' }].map(toApplication).map(toComparisonItem);
  const rows = comparisonRows(items);
  for (const key of ['price', 'period', 'winner']) assert.equal(rows.find(row => row.key === key).different, true);
  const csv = comparisonCsv(items, rows);
  for (const value of ['601,000,000원', '604,000,000원', '2026-10-20', '2027-10-20', '2027-11-01']) assert.ok(csv.includes(value));
  assert.equal(comparisonRows([items[0], { ...items[0], id: 2 }]).some(row => row.different), false);
});

test('comparison marks invalid and missing values without inventing known bounds', () => {
  const item = toComparisonItem(toApplication({ ...notice, minPrice: null, maxPrice: 0, applyStartDate: 'bad', winnerAnnounceDate: '2026-02-30' }));
  assert.equal(item.price, '분양가 최소 미확인 — 최대 0원');
  assert.equal(item.period, '시작 미확인 — 마감 2026-10-21');
  assert.equal(item.winnerDate, '미확인');
  assert.match(toComparisonItem(toApplication({ ...notice, minPrice: 2, maxPrice: 1 })).price, /확인 필요/);
});

test('unit match uses the display validity rules only for constrained fields', () => {
  for (const maxPrice of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, undefined, NaN]) {
    assert.equal(unitMatchesRange({ maxPrice, supplyArea: 59 }, { maxPrice: Number.MAX_SAFE_INTEGER }), false);
    assert.equal(unitMatchesRange({ maxPrice, supplyArea: 59 }, { maxArea: 85 }), true);
  }
  for (const supplyArea of [0, -1, null, undefined, NaN]) {
    assert.equal(unitMatchesRange({ maxPrice: 0, supplyArea }, { maxArea: 85 }), false);
    assert.equal(unitMatchesRange({ maxPrice: 0, supplyArea }, { maxPrice: 0 }), true);
  }
  assert.equal(unitMatchesRange({ maxPrice: Number.MAX_SAFE_INTEGER, supplyArea: 1 }, { maxPrice: Number.MAX_SAFE_INTEGER, minArea: 1 }), true);
});
