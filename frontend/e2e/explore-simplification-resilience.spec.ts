import { expect, test, type Page } from '@playwright/test';

const base = { sourceSystem: 'REB_APT', housingCategory: 'APARTMENT', syncedAt: '2026-10-20T00:00:00Z', applyStartDate: '2026-10-01', applyEndDate: '2026-10-31' };
const publicNotice = { ...base, id: 1, title: '서울 일반 공고', regionCode: '서울', status: 'OPEN' };
const savedNotice = { ...base, id: 2, title: '경기 마감된 관심 공고', regionCode: '경기', status: 'CLOSED', applyEndDate: '2026-09-01' };
const nextSaved = { ...savedNotice, id: 3, title: '부산 마감된 관심 공고', regionCode: '부산' };
async function setup(page: Page, url = '/') {
  const searches: URL[] = [], facets: URL[] = [];
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/notices') {
      searches.push(url);
      const saved = url.searchParams.has('ids');
      const content = saved ? [url.searchParams.get('page') === '1' ? nextSaved : savedNotice] : [publicNotice];
      return route.fulfill({ json: { content, number: Number(url.searchParams.get('page') || 0), size: 24, totalElements: saved ? 2 : 1, totalPages: saved ? 2 : 1 } });
    }
    if (url.pathname.endsWith('/facets')) { facets.push(url); return route.fulfill({ json: { total: 1, open: 1, endingToday: 0, upcoming: 0 } }); }
    if (url.pathname.endsWith('/freshness')) return route.fulfill({ json: {} });
    if (/\/notices\/[23]$/.test(url.pathname)) return route.fulfill({ json: url.pathname.endsWith('2') ? savedNotice : nextSaved });
    return route.fulfill({ status: 401 });
  });
  await page.goto(url);
  await expect(page.locator('.application-card')).toHaveCount(1);
  return { searches, facets };
}

for (const width of process.env.IPHONE_TEST ? [320, 390] : [320, 390, 768, 1000, 1001, 1440]) {
  test(`탐색 역할 ${width}px: 검색은 검색어만, 필터 진입은 한 곳이며 닫기 초점이 복원된다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await expect(page.getByRole('search').getByRole('combobox')).toHaveCount(0);
    const opener = page.getByRole('button', { name: /청약 필터 열기/ });
    await expect(opener).toHaveCount(1);
    await expect(page.getByLabel('목록 지역 필터')).toBeVisible({ visible: width > 1000 });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: '청약 조건 선택' });
    await expect(dialog.getByText(/선택한 조건은 바로 적용/)).toBeVisible();
    await dialog.getByRole('button', { name: '서울', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await expect(page.getByRole('button', { name: '지역: 서울 조건 해제', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ([320, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: `test-results/explore-simplified-${width}.png`, fullPage: false });
    }
  });
}

test('선택 조건: 예산·면적 값을 한 번 표시하고 전체 초기화 버튼이 가로 스크롤 없이 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page, '/?q=아주긴검색어반복반복반복반복반복반복반복반복&region=서울&category=APARTMENT&supplyType=SALE&minPriceManwon=100&maxPriceManwon=200&minArea=20.5&maxArea=84.5');
  const chips = page.getByRole('group', { name: '검색 조건 해제' });
  await expect(page.locator('.active-filter-summary')).toHaveCount(0);
  const price = chips.getByRole('button', { name: '예산: 100–200만원 조건 해제', exact: true });
  await expect(price).toHaveText('예산: 100–200만원 ×');
  await expect(chips.getByRole('button', { name: '면적: 20.5–84.5㎡ 조건 해제', exact: true })).toBeVisible();
  expect(await chips.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await price.click();
  await expect.poll(() => new URL(page.url()).searchParams.has('maxPriceManwon')).toBe(false);
  expect(new URL(page.url()).searchParams.get('maxArea')).toBe('84.5');
  await page.getByRole('button', { name: '검색 조건 되돌리기', exact: true }).click();
  await expect(price).toBeVisible();
  await chips.getByRole('button', { name: '검색 조건 전체 초기화', exact: true }).click();
  await expect(chips).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe('');
});

test('필터 초기화는 검색어·상태를 보존하고 검색어 지우기는 입력 초점을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setup(page, '/?q=서울&region=서울&status=open&maxArea=84.5');
  await page.getByRole('button', { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole('dialog', { name: '청약 조건 선택' });
  await dialog.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => new URL(page.url()).searchParams.has('region')).toBe(false);
  expect(new URL(page.url()).searchParams.get('q')).toBe('서울');
  expect(new URL(page.url()).searchParams.get('status')).toBe('open');
  await page.getByRole('button', { name: '검색어 지우기' }).click();
  await expect(page.getByLabel('청약 검색어', { exact: true })).toBeFocused();
  await expect(page.getByLabel('청약 검색어', { exact: true })).toHaveValue('');
});

test('관심청약은 일반 조건과 독립적으로 마감 공고·다음 페이지를 보여주고 돌아오면 조건을 복원한다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cheongyak-one-saved', '[2,3]'));
  const { searches, facets } = await setup(page, '/?q=서울&region=서울&category=APARTMENT&supplyType=SALE&minPriceManwon=100&maxPriceManwon=200&minArea=20&maxArea=84.5&status=open&sort=PRICE_ASC');
  await page.getByRole('button', { name: '관심청약 2개', exact: true }).click();
  await expect(page.getByRole('heading', { name: savedNotice.title, exact: true })).toBeVisible();
  await expect(page.getByRole('tablist', { name: '청약 상태' }).locator('[aria-selected="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /청약 필터 열기/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검색 공유', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /다음 1건 더보기/ }).click();
  await expect(page.getByRole('heading', { name: nextSaved.title, exact: true })).toBeVisible();
  const savedRequests = searches.filter(url => url.searchParams.has('ids'));
  expect(savedRequests.length).toBeGreaterThanOrEqual(2);
  for (const url of savedRequests) {
    expect(url.searchParams.getAll('ids')).toEqual(['2', '3']);
    for (const key of ['keyword', 'region', 'category', 'supplyType', 'status', 'minPrice', 'maxPrice', 'minArea', 'maxArea', 'activeOnly', 'endingToday']) expect(url.searchParams.has(key)).toBe(false);
  }
  await page.clock.install();
  await page.getByLabel('청약 검색어', { exact: true }).fill('새 검색');
  await expect.poll(() => facets.at(-1)?.searchParams.get('keyword')).toBe('새 검색');
  // Let a mistakenly scheduled list reload run before asserting page preservation.
  await page.clock.fastForward(1000);
  expect(facets.at(-1)?.searchParams.get('region')).toBe('서울');
  expect(facets.at(-1)?.searchParams.get('maxArea')).toBe('84.5');
  await expect(page.getByRole('heading', { name: nextSaved.title, exact: true })).toBeVisible();
  expect(searches.filter(url => url.searchParams.has('ids'))).toHaveLength(savedRequests.length);
  await page.getByRole('button', { name: '공고 탐색으로 돌아가기' }).click();
  await expect(page.getByRole('heading', { name: publicNotice.title, exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /접수중/ })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => searches.some(url => !url.searchParams.has('ids') && url.searchParams.get('keyword') === '새 검색' && url.searchParams.get('status') === 'OPEN' && url.searchParams.get('maxArea') === '84.5')).toBe(true);
  expect(new URL(page.url()).searchParams.get('sort')).toBe('PRICE_ASC');
});


test('빈 관심목록에서 돌아가도 이전 일반 검색 조건은 사라지지 않는다', async ({ page }) => {
  await setup(page, '/?q=서울&region=서울&maxArea=84.5&status=open');
  await page.getByRole('button', { name: '관심청약 0개', exact: true }).click();
  await expect(page.getByRole('heading', { name: '저장한 관심청약이 없어요', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이전 검색으로 돌아가기', exact: true }).click();
  await expect(page.getByRole('heading', { name: publicNotice.title, exact: true })).toBeVisible();
  const params = new URL(page.url()).searchParams;
  expect(params.get('q')).toBe('서울');
  expect(params.get('region')).toBe('서울');
  expect(params.get('maxArea')).toBe('84.5');
  expect(params.get('status')).toBe('open');
});
