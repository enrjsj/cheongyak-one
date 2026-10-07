import { test, expect } from '@playwright/test';

const base = { housingCategory: 'APARTMENT', sourceSystem: 'REB_APT', regionCode: '서울', address: '서울특별시 강남구', minPrice: 450000000, totalUnits: 100, syncedAt: '2026-10-07T00:00:00Z' };
const notices = [
  { ...base, id: 901, title: '서울숲 센트럴 입주자 모집', status: 'OPEN', applyStartDate: '2026-10-01', applyEndDate: '2026-10-20' },
  { ...base, id: 902, title: '내일 접수가 시작되는 청년 행복주택', status: 'UPCOMING', housingCategory: 'PUBLIC_RENTAL', applyStartDate: '2026-10-08', applyEndDate: '2026-10-16' },
  { ...base, id: 903, title: '접수 마감이 가까운 공고', status: 'OPEN', applyStartDate: '2026-10-01', applyEndDate: '2026-10-09' },
  { ...base, id: 904, title: '아직 여유 있는 예정 공고', status: 'UPCOMING', applyStartDate: '2026-10-20', applyEndDate: '2026-10-30' },
  { ...base, id: 905, title: '일정이 확인되지 않은 공고', status: 'UPCOMING' },
  { ...base, id: 906, title: '접수 종료 공고', status: 'CLOSED', applyStartDate: '2026-10-01', applyEndDate: '2026-10-06' },
];

for (const width of [320, 390, 1440]) test(`공고 상태와 임박 일정은 색상·문구·날짜로 구분된다 (${width}px)`, async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-07T03:00:00Z'));
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/notices') return route.fulfill({ json: { content: notices, number: 0, size: 12, totalElements: 6, totalPages: 1 } });
    if (path.endsWith('/facets')) return route.fulfill({ json: { total: 6, open: 2, upcoming: 3, endingToday: 0 } });
    if (path.endsWith('/freshness')) return route.fulfill({ json: {} });
    return route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/?includeClosed=true');
  const card = (id: number) => page.locator(`#notice-card-${id}`);
  await expect(card(901).locator('.notice-status')).toHaveText('접수중');
  await expect(card(901).locator('.notice-countdown')).toContainText('마감 D-13');
  await expect(card(902).locator('.notice-status')).toHaveText('오픈 예정');
  await expect(card(902).locator('.schedule-hint')).toHaveText('곧 접수 시작');
  await expect(card(902).locator('.notice-countdown')).toContainText('내일 시작');
  await expect(card(902).locator('time')).toHaveAttribute('datetime', '2026-10-08');
  await expect(card(903).locator('.schedule-hint')).toHaveText('마감 임박');
  await expect(card(903).locator('.notice-countdown')).toContainText('마감 D-2');
  await expect(card(904)).not.toHaveClass(/schedule-near/);
  await expect(card(905).locator('.notice-countdown')).toContainText('공고문 확인');
  await expect(card(905).locator('time')).toHaveCount(0);
  await expect(card(906)).not.toHaveClass(/schedule-near/);
  const colors = await Promise.all([901, 902, 903].map(id => card(id).locator('.notice-status').evaluate(el => getComputedStyle(el).backgroundColor)));
  expect(new Set(colors).size).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.application-card, .notice-countdown').evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth))).toBe(true);
  await card(902).screenshot({ path: testInfo.outputPath('upcoming-card.png') });
  await card(903).screenshot({ path: testInfo.outputPath('urgent-card.png') });
  expect(errors).toEqual([]);
});
