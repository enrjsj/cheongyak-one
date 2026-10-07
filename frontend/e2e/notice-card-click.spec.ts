import { test, expect, type Page, type Locator, type Route } from '@playwright/test';

const notice = { id: 801, title: '용인 양지 서희스타힐스 하이뷰', housingCategory: 'APARTMENT', sourceSystem: 'REB_APT', status: 'UPCOMING', regionCode: '경기', address: '경기도 용인시 처인구', minPrice: 430000000, maxPrice: 580000000, totalUnits: 48, applyStartDate: '2026-10-12', applyEndDate: '2026-10-14', syncedAt: '2026-10-07T00:00:00Z' };

async function mockApi(page: Page, signedIn = false) {
  let detailRequests = 0;
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path === '/api/v1/notices') return json({ content: [notice], number: 0, size: 12, totalElements: 1, totalPages: 1 });
    if (path === '/api/v1/notices/801') { detailRequests++; return json({ ...notice, businessEntityName: '테스트 공급기관' }); }
    if (path.endsWith('/facets')) return json({ total: 1, open: 0, upcoming: 1, endingToday: 0 });
    if (path.endsWith('/changes')) return json([]);
    if (path === '/api/v1/members/me') return signedIn ? json({ id: 1, nickname: '테스트 회원', email: 'test@example.invalid', role: 'MEMBER', emailVerified: true }) : route.fulfill({ status: 401, json: {} });
    if (path.endsWith('/favorites') || path.endsWith('/comparisons')) return json({ noticeIds: [] });
    if (path.endsWith('/favorites/tracker') || path.endsWith('/saved-search-profiles')) return json([]);
    if (path.endsWith('/search-preference') || path.endsWith('/eligibility-profile')) return json(null);
    if (path.endsWith('/recommendations')) return json({ configured: false, recommendations: [], dismissedCount: 0 });
    if (path.endsWith('/notifications')) return json({ notifications: [], unreadCount: 0 });
    return json({});
  });
  return () => detailRequests;
}

// Click actual screen coordinates: the native detail button covers the static facts.
async function clickPoint(page: Page, target: Locator, leftEdge = false) {
  await target.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const box = await target.boundingBox();
  if (!box) throw new Error('Target is not visible');
  await page.mouse.click(box.x + (leftEdge ? 4 : box.width / 2), box.y + box.height / 2);
}

for (const width of [320, 390, 1440]) test(`카드 본문·키보드는 상세를 열고 북마크·비교는 독립 동작한다 (${width}px)`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.clock.setFixedTime(new Date('2026-10-07T03:00:00Z'));
  const detailRequests = await mockApi(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const card = page.locator('#notice-card-801');
  const opener = card.getByRole('button', { name: `${notice.title} 공고 상세 보기`, exact: true });
  const bookmark = card.locator('.bookmark');
  await expect(opener).toBeVisible();
  for (const selector of ['h3', '.notice-status', '.notice-provider', '.location', '.notice-countdown', '.notice-price', '.card-facts > div:nth-child(2)', '.card-facts > div:last-child']) {
    const before = detailRequests();
    await clickPoint(page, card.locator(selector));
    await expect(page.getByRole('dialog')).toContainText('테스트 공급기관');
    await expect.poll(() => detailRequests()).toBe(before + 1);
    expect(new URL(page.url()).searchParams.get('notice')).toBe('801');
    await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.has('notice')).toBe(false);
  }
  for (const key of ['Enter', 'Space']) {
    await opener.focus(); await opener.press(key);
    await expect(page.getByRole('dialog')).toContainText('테스트 공급기관');
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
  }
  const footer = card.getByRole('button', { name: '공고 핵심만 보기', exact: true });
  await footer.click(); await expect(page.getByRole('dialog')).toContainText('테스트 공급기관');
  await page.keyboard.press('Escape'); await expect(footer).toBeFocused();
  const beforeBookmark = detailRequests();
  await bookmark.click(); await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await clickPoint(page, card.locator('.notice-bookmark-zone'), true);
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await bookmark.click(); await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
  expect(detailRequests()).toBe(beforeBookmark);
  const compare = card.getByRole('button', { name: '비교 담기', exact: true });
  await compare.click(); await expect(card.getByRole('button', { name: '비교 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('notice')).toBe(false);
  expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.screenshot({ path: testInfo.outputPath('clickable-card.png') });
  expect(errors).toEqual([]);
});

test('저장 요청 중 비활성화된 북마크를 다시 눌러도 상세가 열리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  const detailRequests = await mockApi(page, true);
  let pending: Route | undefined;
  let saves = 0;
  await page.route('**/api/v1/members/me/favorites/801', route => { saves++; pending = route; });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '테스트 회원', exact: true })).toBeVisible();
  const bookmark = page.locator('#notice-card-801 .bookmark');
  await bookmark.click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(bookmark).toBeDisabled();
  await clickPoint(page, bookmark);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(detailRequests()).toBe(0); expect(saves).toBe(1);
  await pending!.fulfill({ json: { noticeIds: [801] } });
  await expect(bookmark).toBeEnabled();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
});
