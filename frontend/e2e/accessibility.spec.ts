import { test, expect, type Page } from '@playwright/test';
import { expectAccessibleControls, expectTextContrast } from './accessibility-helpers';

test('대비 검사: 불투명 자식 위 조상의 합성 효과도 통과시키지 않는다', async ({ page }) => {
  await page.setContent(`<main><div id="wrapper"><article style="background: white; color: black">${'<p>대비 검증 문구</p>'.repeat(11)}</article></div></main>`);
  const card = page.locator('article');
  await expectTextContrast(card);
  await page.locator('#wrapper').evaluate(element => element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }));
  await expectTextContrast(card);
  for (const effect of ['opacity: .2', 'filter: opacity(.2)', 'mix-blend-mode: screen']) {
    await page.locator('#wrapper').evaluate((element, value) => element.setAttribute('style', value), effect);
    await expect(expectTextContrast(card)).rejects.toThrow(/unsupported paint/);
  }
});

const notices = [
  { id: 951, title: '서울 접근성 아파트 입주자 모집', housingCategory: 'APARTMENT', sourceSystem: 'REB_APT', businessEntityName: '테스트 공급기관', regionCode: '서울', address: '서울특별시 성동구', status: 'OPEN', minPrice: 400000000, maxPrice: 700000000, totalUnits: 50, applyStartDate: '2026-10-05', applyEndDate: '2026-10-09', winnerAnnounceDate: '2026-10-15', syncedAt: '2026-10-07T00:00:00Z' },
  { id: 952, title: '경기 공공임대 모집', housingCategory: 'PUBLIC_RENTAL', sourceSystem: 'MYHOME_PUBLIC_RENTAL', regionCode: '경기', status: 'UPCOMING', applyStartDate: '2026-10-12', applyEndDate: '2026-10-16', syncedAt: '2026-10-07T00:00:00Z' },
  { id: 953, title: '일정 미확인 오피스텔 공고', housingCategory: 'OFFICETEL', sourceSystem: 'REB_OFFICETEL', status: 'CLOSED', syncedAt: '2026-10-07T00:00:00Z' },
];
async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-07T03:00:00Z'));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/notices') return route.fulfill({ json: { content: notices, number: 0, size: 12, totalElements: notices.length, totalPages: 1 } });
    if (path === '/api/v1/notices/951') return route.fulfill({ json: { ...notices[0], officialUrl: 'https://example.com/notice', specialSupplyStartDate: '2026-10-02', specialSupplyEndDate: '2026-10-02', contractStartDate: '2026-10-20', contractEndDate: '2026-10-22', contactPhone: '02-0000-0000', unitTypes: [{ modelId: '59A', housingTypeName: '059A', supplyArea: 59, maxPrice: 400000000, generalSupplyCount: 20, specialSupplyCount: 30, totalSupplyCount: 50 }] } });
    if (path.endsWith('/facets')) return route.fulfill({ json: { total: 3, open: 1, upcoming: 1, endingToday: 0 } });
    if (path.endsWith('/changes')) return route.fulfill({ json: [] });
    if (path.endsWith('/freshness')) return route.fulfill({ json: {} });
    return route.fulfill({ status: 401, json: { detail: '로그인 필요' } });
  });
  await page.goto('/');
  await expect(page.locator('.application-card')).toHaveCount(notices.length);
  await expect(page.locator('.header-actions').getByRole('button', { name: '로그인', exact: true })).toBeEnabled();
}

for (const width of [320, 390, 1440]) test.describe(`접근성 ${width}px`, () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile && width === 1440, 'iPhone은 모바일 너비만 검사한다.');
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
  });

  test('목록의 버튼 이름·제목·랜드마크·텍스트 대비', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('tablist', { name: '청약 상태' })).toBeVisible();
    for (const notice of notices) {
      const card = page.getByRole('article', { name: notice.title });
      await expect(card.getByRole('heading', { level: 3, name: notice.title })).toBeVisible();
      await expect(card.getByRole('button', { name: `${notice.title} 공고 상세 보기`, exact: true })).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(card.getByRole('button', { name: `${notice.title} 관심청약 저장`, exact: true })).toHaveAttribute('aria-pressed', 'false');
      await expect(card.getByRole('term')).toHaveCount(3);
      await expect(card.getByRole('definition')).toHaveCount(3);
    }
    await expectAccessibleControls(page.locator('body'));
    await expectTextContrast(page.locator('body'));
  });

  test('필터의 입력 이름·오류 연결·선택 상태·텍스트 대비', async ({ page }) => {
    await page.getByRole('button', { name: /^청약 필터 열기/ }).click();
    const dialog = page.getByRole('dialog', { name: '청약 조건 선택' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveCSS('opacity', '1');
    for (const [heading, selected, alternative] of [['지역', '서울', '경기'], ['주택 유형', '아파트', '오피스텔'], ['공급 방식', '분양', '공공임대']]) {
      const group = dialog.locator('.filter-group').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
      await group.getByRole('button', { name: selected, exact: true }).click();
      await expect(group.getByRole('button', { name: selected, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(group.getByRole('button', { name: alternative, exact: true })).toHaveAttribute('aria-pressed', 'false');
      await expect(group.getByRole('button', { name: '전체', exact: true })).toHaveAttribute('aria-pressed', 'false');
    }
    await dialog.getByRole('button', { name: '5억 이하', exact: true }).click();
    await expect(dialog.getByRole('button', { name: '5억 이하', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expectTextContrast(dialog);
    const min = dialog.getByRole('textbox', { name: '예산 최소 (만원)', exact: true });
    await min.fill('60000');
    await expect(min).toHaveAttribute('aria-invalid', 'true');
    await expect(min).toHaveAccessibleDescription(/최소.*최대/);
    await expectAccessibleControls(dialog);
    await expectTextContrast(dialog);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('상세의 모달·표·폼 이름과 텍스트 대비', async ({ page }) => {
    const opener = page.getByRole('button', { name: `${notices[0].title} 공고 상세 보기`, exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: notices[0].title, exact: true });
    await expect(dialog).toHaveAttribute('aria-busy', 'false');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveCSS('opacity', '1');
    await expect(dialog.getByRole('heading', { level: 2, name: notices[0].title })).toBeVisible();
    await expect(dialog.getByRole('table', { name: '주택형 공급 목록' })).toBeVisible();
    await expectAccessibleControls(dialog);
    await expectTextContrast(dialog);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});
