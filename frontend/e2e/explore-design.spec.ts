import { test, expect, type Page } from '@playwright/test';

const listings = [
  { id: 801, title: '서울숲 리버파크 아파트 입주자 모집 공고', housingCategory: 'APARTMENT', sourceSystem: 'REB_APT', regionCode: '서울', address: '서울특별시 성동구 성수동', status: 'OPEN', minPrice: 590000000, maxPrice: 820000000, totalUnits: 248, applyStartDate: '2026-10-08', applyEndDate: '2026-10-12', syncedAt: '2026-10-07T00:00:00Z' },
  { id: 802, title: '경기 청년 행복주택 추가 모집', housingCategory: 'PUBLIC_RENTAL', sourceSystem: 'MYHOME_PUBLIC_RENTAL', regionCode: '경기', status: 'UPCOMING', minPrice: 30000000, maxPrice: 60000000, applyStartDate: '2026-10-15', syncedAt: '2026-10-07T00:00:00Z' },
  { id: 803, title: '사진과 가격 자료가 없는 오피스텔 공고도 제목과 정보가 길어질 때 전체 내용을 확인할 수 있습니다', housingCategory: 'OFFICETEL', sourceSystem: 'REB_OFFICETEL', status: 'OPEN', syncedAt: '2026-10-07T00:00:00Z' },
];
async function setup(page: Page) {
  const searches: URL[] = [], writes: string[] = [];
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') writes.push(route.request().method() + url.pathname);
    if (url.pathname === '/api/v1/notices') { searches.push(url); return route.fulfill({ json: { content: listings, number: 0, size: 12, totalElements: 3, totalPages: 1 } }); }
    if (url.pathname === '/api/v1/notices/801') return route.fulfill({ json: { ...listings[0], businessEntityName: '테스트 공급주체' } });
    if (url.pathname.endsWith('/facets')) return route.fulfill({ json: { total: 3, open: 2, upcoming: 1, endingToday: 0 } });
    if (url.pathname.endsWith('/changes')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/freshness')) return route.fulfill({ json: {} });
    return route.fulfill({ status: 401, json: { detail: '로그인 필요' } });
  });
  await page.goto('/');
  await expect(page.locator('.application-card')).toHaveCount(3);
  return { searches, writes };
}

for (const width of [320, 390, 768, 1440]) test(`탐색 개편 ${width}px: 사진 없이 핵심 정보·미확인 값과 검색 도구를 읽을 수 있다`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  const { writes } = await setup(page);
  const card = page.locator('.application-card').first();
  await expect(card.locator('h3')).toHaveText(listings[0].title);
  await expect(card.locator('.notice-provider')).toHaveText('공급기관 공고문 확인');
  await expect(card.locator('.card-facts')).toContainText('분양가 5.9억 — 8.2억');
  await expect(card.locator('.card-facts')).toContainText('2026.10.08 — 2026.10.12');
  await expect(card.locator('.card-facts')).toContainText('서울 · 총 248세대 공급');
  await expect(page.locator('.application-card').nth(1).locator('.card-facts')).toContainText('임대보증금 3,000만원 — 6,000만원');
  await expect(page.locator('.application-card').nth(1).locator('.card-facts')).toContainText('종료일 미확인');
  await expect(page.locator('.application-card').nth(2).locator('.card-facts')).toContainText('접수일정은 공고문 확인');
  await expect(page.locator('.application-card img')).toHaveCount(0);
  await expect(page.locator('.header-actions').getByRole('button', { name: '로그인', exact: true }).locator('span')).toBeVisible();
  const share = page.getByRole('button', { name: '검색 공유', exact: true });
  expect(await share.evaluate(el => el.getBoundingClientRect().width > 65)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.application-card').evaluateAll(cards => cards.every(el => el.scrollWidth <= el.clientWidth))).toBe(true);
  await card.getByRole('button', { name: /공고 핵심만 보기/ }).click();
  await expect(page.getByRole('dialog')).toContainText('테스트 공급주체');
  await page.keyboard.press('Escape');
  await expect(card.locator('.notice-provider')).toHaveText('공급기관 테스트 공급주체');
  expect(errors).toEqual([]); expect(writes).toEqual([]);
});

test('탐색 개편: 상단 검색과 PC 필터는 같은 조건을 API·URL·상세 필터에 반영한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { searches } = await setup(page);
  await page.getByLabel('빠른 지역 선택', { exact: true }).selectOption('서울');
  await expect(page.getByLabel('목록 지역 필터')).toHaveValue('서울');
  await expect.poll(() => searches.at(-1)?.searchParams.get('region')).toBe('서울');
  await page.getByLabel('목록 주택 유형 필터').selectOption('아파트');
  await expect(page.getByLabel('빠른 주택 유형 선택')).toHaveValue('아파트');
  await expect.poll(() => searches.at(-1)?.searchParams.get('category')).toBe('APARTMENT');
  await page.getByLabel('목록 공급 방식 필터').selectOption('SALE');
  await expect.poll(() => new URL(page.url()).searchParams.get('supplyType')).toBe('SALE');
  await page.getByRole('button', { name: /상세 조건 설정/ }).click();
  const dialog = page.getByRole('dialog', { name: '청약 조건 선택' });
  await expect(dialog.getByRole('button', { name: '서울', exact: true })).toHaveClass('active');
  await expect(dialog.getByRole('button', { name: '분양', exact: true })).toHaveClass('active');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '조건 초기화', exact: true }).click();
  await expect(page.getByLabel('빠른 지역 선택')).toHaveValue('전체');
  await expect(page.getByLabel('빠른 주택 유형 선택')).toHaveValue('전체');
  await expect(page.getByLabel('목록 공급 방식 필터')).toHaveValue('');
});
