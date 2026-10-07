import { test, expect, type Page } from '@playwright/test';

const units = [
  { modelId: 'a', housingTypeName: '084A', supplyArea: 84.12, maxPrice: 700000001, generalSupplyCount: 10, specialSupplyCount: 0, totalSupplyCount: 10 },
  { modelId: 'b', housingTypeName: '059B', supplyArea: 59.9, maxPrice: 400000000, generalSupplyCount: 30, specialSupplyCount: 20, totalSupplyCount: 50 },
  { modelId: 'c', housingTypeName: '084C', supplyArea: 84.13, maxPrice: 700000002, generalSupplyCount: 0, specialSupplyCount: 0, totalSupplyCount: 0 },
  { modelId: 'd', housingTypeName: '099D' },
];
const notice = { id: 902, title: '주택형 탐색 공고', housingCategory: 'APARTMENT', sourceSystem: 'REB_APT', regionCode: '서울', status: 'OPEN', syncedAt: '2026-10-07T00:00:00Z', unitTypes: units };
async function setup(page: Page, query = '') {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/notices/902') return route.fulfill({ json: notice });
    if (path === '/api/v1/notices') return route.fulfill({ json: { content: [notice], number: 0, totalElements: 1, totalPages: 1, size: 24 } });
    if (path.endsWith('/facets')) return route.fulfill({ json: { total: 1, open: 1, upcoming: 0, endingToday: 0 } });
    if (path.endsWith('/changes')) return route.fulfill({ json: [] });
    if (path.endsWith('/freshness')) return route.fulfill({ json: {} });
    return route.fulfill({ status: 401, json: { detail: '로그인 필요' } });
  });
  await page.goto('/?notice=902' + query);
  return page.getByRole('region', { name: '주택형별 공급·분양가', exact: true });
}

for (const width of [320, 1280]) test(`주택형 ${width}px: 정렬·필터 중 선택을 유지하고 같은 공고에서 비교한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
  const panel = await setup(page, '&maxPriceManwon=40000');
  const table = panel.getByRole('table', { name: '주택형 공급 목록' });
  await panel.getByRole('checkbox', { name: '84A 주택형 비교 선택' }).check();
  await panel.getByLabel('주택형 정렬', { exact: true }).selectOption('PRICE_ASC');
  await expect(table.locator('tbody th').first()).toContainText('59B');
  await expect(table.locator('tbody th').last()).toContainText('99D');
  await panel.getByRole('checkbox', { name: '검색 조건 일치만 보기' }).check();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await panel.getByRole('checkbox', { name: '59B 주택형 비교 선택' }).check();
  const comparison = panel.getByRole('table', { name: '선택 주택형 비교표', exact: true });
  await expect(comparison.getByRole('columnheader', { name: '84A (기준)' })).toBeVisible();
  expect(await comparison.evaluate(table => {
    const cell = table.querySelector('tbody td')!, wrapper = table.parentElement!;
    const text = document.createRange(); text.selectNodeContents(cell);
    return text.getBoundingClientRect().right <= wrapper.getBoundingClientRect().right;
  })).toBe(true);
  await expect(comparison.getByRole('row', { name: /^최고 분양가/ })).toContainText('기준 대비 −300,000,001원');
  await panel.getByRole('checkbox', { name: '검색 조건 일치만 보기' }).uncheck();
  await panel.getByRole('checkbox', { name: '84C 주택형 비교 선택' }).check();
  await expect(panel.getByRole('checkbox', { name: '99D 주택형 비교 선택' })).toBeDisabled();
  await expect(comparison.getByRole('row', { name: /^최고 분양가/ })).toContainText('기준 대비 +1원');
  await expect(comparison.getByRole('row', { name: /^공급면적/ })).toContainText('기준 대비 +0.01㎡');
  await panel.getByRole('button', { name: '기준 · 84A 비교 해제', exact: true }).click();
  await expect(comparison.getByRole('columnheader', { name: '59B (기준)' })).toBeVisible();
  await expect(panel.getByRole('checkbox', { name: '99D 주택형 비교 선택' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('article').filter({ hasText: notice.title }).getByRole('button', { name: /공고 핵심만 보기/ }).click();
  await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await expect(panel.getByLabel('주택형 정렬')).toHaveValue('ORIGINAL');
  await expect(comparison).toHaveCount(0);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
});

test('주택형: 결과 없음에서 전체 복구, 미확인 비교와 비우기', async ({ page }) => {
  const panel = await setup(page, '&maxPriceManwon=10000');
  await panel.getByRole('checkbox', { name: '검색 조건 일치만 보기' }).check();
  await expect(panel.getByText('현재 검색 조건에 맞는 주택형이 없습니다.', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '모든 주택형 보기' }).click();
  await expect(panel.getByRole('table', { name: '주택형 공급 목록' }).locator('tbody tr')).toHaveCount(4);
  await panel.getByRole('checkbox', { name: '99D 주택형 비교 선택' }).check();
  await panel.getByRole('checkbox', { name: '84C 주택형 비교 선택' }).check();
  const row = panel.getByRole('table', { name: '선택 주택형 비교표', exact: true }).getByRole('row', { name: /^공급 합계/ });
  await expect(row).toContainText('미확인'); await expect(row).toContainText('0세대'); await expect(row).toContainText('차이 미확인');
  await expect(panel.getByRole('definition').nth(1)).toHaveText('공고문 확인');
  await panel.getByRole('button', { name: '주택형 비교 비우기' }).click();
  await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0);
});

test('주택형: 상세 오류와 공고 전환에 이전 비교를 남기지 않는다', async ({ page }) => {
  const panel = await setup(page);
  await expect(panel.getByRole('checkbox', { name: '검색 조건 일치만 보기' })).toHaveCount(0);
  await panel.getByRole('checkbox', { name: '84A 주택형 비교 선택' }).check();
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  let fails = true;
  await page.route('**/api/v1/notices/902', route => route.fulfill(fails ? { status: 503, json: { detail: '일시 오류' } } : { json: notice }));
  await page.locator('article').getByRole('button', { name: /공고 핵심만 보기/ }).click();
  await expect(page.getByRole('button', { name: '상세 다시 불러오기' })).toBeVisible();
  await expect(panel).toHaveCount(0);
  fails = false; await page.getByRole('button', { name: '상세 다시 불러오기' }).click();
  await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await panel.getByRole('checkbox', { name: '84A 주택형 비교 선택' }).check();
  await page.route('**/api/v1/notices/903', route => route.fulfill({ json: { ...notice, id: 903, title: '다른 공고', unitTypes: [units[1]] } }));
  await page.evaluate(() => { history.pushState({}, '', '/?notice=903'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByRole('dialog')).toContainText('다른 공고');
  await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await expect(panel.getByRole('table', { name: '주택형 공급 목록' }).locator('tbody tr')).toHaveCount(1);
});
