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

test('모바일 상세 확인 안내·터치 크기·키보드 순환', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page);
  await expect(page.locator('.search-field input')).toHaveCSS('font-size', '16px');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/api/v1/notices/951', async route => {
    requests++;
    await pending;
    await route.fulfill({ json: { ...notices[0], businessEntityName: '   ', maxPrice: null, unitTypes: [], officialUrl: 'https://example.com/notice' } });
  });
  const opener = page.getByRole('button', { name: `${notices[0].title} 공고 상세 보기`, exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: notices[0].title, exact: true });
  await expect(dialog.getByRole('status')).toContainText('최신 상세');
  await expect(dialog.locator('.notice-quality')).toHaveCount(0);
  release();
  const panel = dialog.locator('.notice-quality');
  await expect(panel.locator('summary')).toHaveText('공고문에서 확인할 정보 3개');
  await panel.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveAttribute('open', '');
  await expect(panel).toContainText('자료 미제공이 수집 실패를 뜻하지는 않습니다.');
  await expect(panel.locator('li')).toHaveCount(3);
  await expectTextContrast(dialog);
  const close = dialog.getByRole('button', { name: '닫기', exact: true });
  const box = await close.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: '공식 공고 보기' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  expect(requests).toBe(1);
  await close.click();
  await expect(opener).toBeFocused();
});

test('주택형 부분 수치 안내는 누락과 오류를 구별하고 정상 0을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page);
  const unit = { modelId: 'A', housingTypeName: '059A', supplyArea: 59.9, maxPrice: 0, generalSupplyCount: 0, specialSupplyCount: 0, totalSupplyCount: 0 };
  let requests = 0;
  await page.route('**/api/v1/notices/951', route => {
    requests++;
    return route.fulfill({ json: { ...notices[0], unitTypes: [unit, { ...unit, modelId: 'B', housingTypeName: '084B', supplyArea: null, maxPrice: -1, totalSupplyCount: null }] } });
  });
  await page.getByRole('button', { name: `${notices[0].title} 공고 상세 보기`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: notices[0].title, exact: true });
  const panel = dialog.locator('.notice-quality');
  await expect(panel.locator('summary')).toHaveText('공고문에서 확인할 정보 3개');
  await panel.locator('summary').click();
  await expect(panel).toContainText('미제공 · 주택형 2개 중 1개의 공급면적 정보가 제공되지 않았습니다.');
  await expect(panel).toContainText('확인 필요 · 주택형 2개 중 1개의 최고 분양가 수치를 공식 공고문에서 확인하세요.');
  await expect(panel).toContainText('미제공 · 주택형 2개 중 1개의 전체 공급 세대 정보가 제공되지 않았습니다.');
  await expect(panel.locator('li')).toHaveCount(3);
  await expect(dialog.getByRole('table', { name: '주택형 공급 목록' })).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(requests).toBe(1);
});

test('상세 확인 안내는 오류·재시도 중 숨기고 정상 응답과 공공임대에 불필요한 경고를 남기지 않는다', async ({ page }) => {
  await setup(page);
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const unit = { modelId: 'A', housingTypeName: '059A', supplyArea: 59.9, maxPrice: 0, generalSupplyCount: 0, specialSupplyCount: 0, totalSupplyCount: 0 };
  await page.route('**/api/v1/notices/951', async route => {
    requests++;
    if (requests === 1) return route.fulfill({ json: { ...notices[0], unitTypes: [] } });
    if (requests === 2) return route.fulfill({ status: 503, json: { detail: '상세 조회 실패' } });
    await pending;
    return route.fulfill({ json: { ...notices[0], unitTypes: [unit] } });
  });
  const opener = page.getByRole('button', { name: `${notices[0].title} 공고 상세 보기`, exact: true });
  const dialog = page.getByRole('dialog', { name: notices[0].title, exact: true });
  await opener.click();
  await expect(dialog.locator('.notice-quality')).toBeVisible();
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await opener.click();
  await expect(dialog.getByRole('alert')).toContainText('최신 상세 정보를 확인하지 못했습니다.');
  await expect(dialog.locator('.notice-quality')).toHaveCount(0);
  await dialog.getByRole('button', { name: '상세 다시 불러오기' }).click();
  await expect(dialog).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.locator('.notice-quality')).toHaveCount(0);
  release();
  await expect(dialog).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.locator('.unit-explorer')).toBeVisible();
  await expect(dialog.locator('.notice-quality')).toHaveCount(0);
  expect(requests).toBe(3);
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(opener).toBeFocused();
  await page.route('**/api/v1/notices/952', route => route.fulfill({ json: { ...notices[0], ...notices[1], businessEntityName: '임대 공급기관', minPrice: 0, maxPrice: 100, unitTypes: [{ modelId: 'rental', housingTypeName: '임대' }] } }));
  await page.getByRole('button', { name: `${notices[1].title} 공고 상세 보기`, exact: true }).click();
  const rental = page.getByRole('dialog', { name: notices[1].title, exact: true });
  await expect(rental).toHaveAttribute('aria-busy', 'false');
  await expect(rental.locator('.notice-quality')).toHaveCount(0);
});

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

test('공고 정확성: 임대 아파트는 분양가로 오인하지 않고 부분 가격을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page);
  const rental = { ...notices[0], rentType: '분양전환 가능임대', minPrice: null, maxPrice: 72000000,
    unitTypes: [{ modelId: 'A', housingTypeName: '059A', supplyArea: 59, maxPrice: 72000000, totalSupplyCount: 1 }] };
  await page.route('**/api/v1/notices?**', route => route.fulfill({ json: { content: [rental], number: 0, size: 12, totalElements: 1, totalPages: 1 } }));
  await page.route('**/api/v1/notices/951', route => route.fulfill({ json: rental }));
  await page.reload();
  const card = page.getByRole('article', { name: rental.title });
  await expect(card).toContainText('공고 금액 최대 7,200만원 · 최소 미확인');
  await card.getByRole('button', { name: `${rental.title} 공고 상세 보기`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: rental.title, exact: true });
  await expect(dialog.getByRole('columnheader', { name: '최고 공고 금액', exact: true })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: '최고 분양가', exact: true })).toHaveCount(0);
  await expect(dialog.locator('.cash-plan')).toContainText('이 분양 대금 계산기를 적용하지 않습니다');
  await expect(dialog.locator('.unit-explorer')).toContainText('임대보증금·월 임대료·분양전환 조건');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('공고 정확성: 비교 차이점은 반올림 금액과 연도 생략에 영향을 받지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await setup(page);
  const first = { ...notices[0], minPrice: 601000000, maxPrice: 601000000, applyStartDate: '2026-10-20', applyEndDate: '2026-10-21', winnerAnnounceDate: '2026-11-01' };
  const second = { ...first, id: 952, title: '비교 두번째 공고', minPrice: 604000000, maxPrice: 604000000, applyStartDate: '2027-10-20', applyEndDate: '2027-10-21', winnerAnnounceDate: '2027-11-01' };
  await page.route('**/api/v1/notices?**', route => route.fulfill({ json: { content: [first, second], number: 0, size: 12, totalElements: 2, totalPages: 1 } }));
  await page.route('**/api/v1/notices/951', route => route.fulfill({ json: first }));
  await page.route('**/api/v1/notices/952', route => route.fulfill({ json: second }));
  await page.goto('/?compare=951,952');
  await page.getByRole('button', { name: '비교하기', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '청약 공고 비교' });
  await dialog.getByRole('button', { name: '차이점만 보기', exact: true }).click();
  await expect(dialog.getByRole('row', { name: /^가격·보증금/ })).toContainText('601,000,000원');
  await expect(dialog.getByRole('row', { name: /^가격·보증금/ })).toContainText('604,000,000원');
  await expect(dialog.getByRole('row', { name: /^접수 일정/ })).toContainText('2027-10-20');
  await expect(dialog.getByRole('row', { name: /^당첨 발표/ })).toContainText('2027-11-01');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

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
    for (const [heading, selected, alternative] of [['지역', '서울', '경기'], ['주택 유형', '아파트', '오피스텔'], ['공급 방식', '분양', '임대']]) {
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
    let release!: () => void;
    const detailResponse = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/notices/951', async route => {
      await detailResponse;
      await route.fallback();
    });
    const opener = page.getByRole('button', { name: `${notices[0].title} 공고 상세 보기`, exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: notices[0].title, exact: true });
    try {
      await expect(dialog).toHaveAttribute('aria-busy', 'true');
      await expect(dialog.getByRole('status')).toHaveText('최신 상세 정보를 확인하고 있어요.');
      await expectAccessibleControls(dialog);
      await expectTextContrast(dialog);
    } finally { release(); }
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
