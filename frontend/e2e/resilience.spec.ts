import { test, expect, type Page, type Route } from "@playwright/test";

async function mockQualityAdmin(page: Page, reply: () => { status?: number; json: unknown }) {
  await mockPublicApi(page);
  await page.route('**/api/v1/members/me**', route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = null;
    if (path === '/api/v1/members/me') data = { id: 10, nickname: '운영 담당자', role: 'ADMIN', emailVerified: true };
    else if (path.endsWith('/favorites') || path.endsWith('/comparisons')) data = { noticeIds: [] };
    else if (path.endsWith('/tracker') || path.endsWith('/saved-search-profiles')) data = [];
    else if (path.endsWith('/recommendations')) data = { configured: false, recommendations: [], dismissedCount: 0 };
    else if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 };
    return route.fulfill({ json: data });
  });
  const requests: string[] = [];
  await page.route('**/api/v1/admin/sync-executions**', route => {
    requests.push(route.request().method());
    return route.fulfill(reply());
  });
  await page.goto('/');
  await page.getByRole('button', { name: '운영 관리', exact: true }).click();
  return requests;
}

const qualityDashboard = (supplierQuality?: unknown[]) => ({ generatedAt: '2026-10-07T00:00:00Z', runningCount: 0, failuresLast24Hours: 0, executions: [], supplierQuality });

for (const width of process.env.IPHONE_TEST ? [390] : [320, 1440]) test(`관리자 공급기관 집계: 누락·0건·작은 비율을 읽기 전용으로 표시 (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const requests = await mockQualityAdmin(page, () => ({ json: qualityDashboard([
    { sourceSystem: 'REB_APT', totalCount: 4, missingSupplierCount: 1 },
    { sourceSystem: 'REB_OFFICETEL', totalCount: 0, missingSupplierCount: 0 },
    { sourceSystem: 'MYHOME_PUBLIC_RENTAL', totalCount: 20000, missingSupplierCount: 1 },
  ]) }));
  const panel = page.getByRole('region', { name: '공급기관 데이터 현황' });
  await panel.scrollIntoViewIfNeeded();
  const apt = panel.getByRole('listitem').filter({ has: page.getByRole('heading', { name: '아파트', exact: true }) });
  await expect(apt).toContainText('저장 공고4건');
  await expect(apt).toContainText('공급기관 미확인1건');
  await expect(apt).toContainText('25%');
  const empty = panel.getByRole('listitem').filter({ hasText: '오피스텔' });
  await expect(empty).toContainText('저장 공고 없음');
  await expect(empty).toContainText('미확인 비율–');
  await expect(panel.getByRole('listitem').filter({ hasText: '공공임대' })).toContainText('0.1% 미만');
  await expect(panel).toContainText('마감 공고도 포함');
  await expect(panel).toContainText('수집 실패를 의미하지 않습니다');
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(requests).toEqual(['GET']);
});

test('관리자 공급기관 집계: 구버전 응답을 0건으로 오인하지 않고 새로고침한다', async ({ page }) => {
  let ready = false;
  const requests = await mockQualityAdmin(page, () => ({ json: ready ? qualityDashboard([
    { sourceSystem: 'REB_APT', totalCount: 10, missingSupplierCount: 0 },
  ]) : qualityDashboard() }));
  const panel = page.getByRole('region', { name: '공급기관 데이터 현황' });
  await expect(panel.getByText('공급기관 집계 정보를 아직 받지 못했습니다.', { exact: true })).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveCount(0);
  ready = true;
  await page.getByRole('dialog', { name: '운영 관리' }).getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(panel).toContainText('미확인 없음');
  await expect(panel).toContainText('저장 공고10건');
  expect(requests).toEqual(['GET', 'GET']);
});

test('관리자 공급기관 집계: 갱신 실패 시 이전 집계를 감추고 재시도 결과로 교체한다', async ({ page }) => {
  let phase = 0;
  const requests = await mockQualityAdmin(page, () => phase === 1 ? { status: 503, json: { detail: '집계 조회 실패' } } : { json: qualityDashboard([
    { sourceSystem: 'REB_APT', totalCount: 10, missingSupplierCount: phase === 0 ? 2 : 1 },
  ]) });
  const dialog = page.getByRole('dialog', { name: '운영 관리' });
  const panel = dialog.getByRole('region', { name: '공급기관 데이터 현황' });
  await expect(panel).toContainText('공급기관 미확인2건');
  phase = 1;
  await dialog.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('집계 조회 실패');
  await expect(panel).toHaveCount(0);
  phase = 2;
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(panel).toContainText('공급기관 미확인1건');
  expect(requests).toEqual(['GET', 'GET', 'GET']);
});

// Keep phone emulation at phone widths; desktop projects cover the 1440px layout.
const supplierWidths = process.env.IPHONE_TEST ? [320, 390] : [320, 390, 1440];
const longSupplier = '한국토지주택공사 서울지역본부 주거복지사업단 공동공급기관';
const supplierCases = [
  { label: '긴 기관명', value: `  ${longSupplier}  `, expected: longSupplier },
  { label: 'null', value: null, expected: '공고문 확인' },
  { label: '공백', value: '   ', expected: '공고문 확인' },
];
for (const width of supplierWidths) for (const scenario of supplierCases) test(`목록 공급기관: ${scenario.label} 첫 표시·상세 응답과 독립 (${width}px)`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await mockPublicApi(page);
  let details = 0;
  await page.route('**/api/v1/notices?**', route => route.fulfill({ json: {
    content: [{ ...notice, businessEntityName: scenario.value }], number: 0, size: 24, totalElements: 1, totalPages: 1,
  } }));
  await page.route('**/api/v1/notices/1', route => {
    details++;
    return route.fulfill({ json: { ...notice, businessEntityName: '상세 응답 기관' } });
  });
  await page.goto('/');
  await expect(page.locator('.application-card')).toHaveCount(1);
  const card = page.locator('#notice-card-1');
  await expect(card.locator('.notice-provider')).toHaveText(`공급기관 ${scenario.expected}`);
  expect(details).toBe(0);
  const opener = card.getByRole('button', { name: '공고 핵심만 보기', exact: true });
  if (testInfo.project.use.hasTouch) await opener.tap(); else await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('상세 응답 기관');
  const close = dialog.getByRole('button', { name: '닫기', exact: true });
  if (testInfo.project.use.hasTouch) await close.tap(); else await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(card.locator('.notice-provider')).toHaveText(`공급기관 ${scenario.expected}`);
  expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(details).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('카드 본문 모바일 터치: 상세 열기와 북마크를 분리하고 닫은 뒤 초점을 복원한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPublicApi(page); await page.goto('/');
  const card = page.locator('#notice-card-1');
  const opener = card.getByRole('button', { name: `${notice.title} 공고 상세 보기`, exact: true });
  await expect(opener).toBeVisible();
  const title = card.locator('h3');
  await title.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const box = await title.boundingBox();
  expect(box).not.toBeNull();
  if (testInfo.project.use.hasTouch) await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  else await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: notice.title, exact: true })).toBeVisible();
  const close = dialog.getByRole('button', { name: '닫기', exact: true });
  if (testInfo.project.use.hasTouch) await close.tap(); else await close.click();
  await expect(opener).toBeFocused();
  const bookmark = card.locator('.bookmark');
  if (testInfo.project.use.hasTouch) await bookmark.tap(); else await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('notice')).toBe(false);
});

test('주택형 탐색 모바일: 비교 선택·정렬·해제 후 닫으면 포커스를 복원한다', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/v1/notices/1', route => route.fulfill({ json: { ...notice, unitTypes: [
    { modelId: 'a', housingTypeName: '84A', supplyArea: 84.12, maxPrice: 700000000 },
    { modelId: 'b', housingTypeName: '59B', supplyArea: 59.9, maxPrice: 400000000 },
  ] } }));
  await page.goto('/');
  const opener = page.locator('article').filter({ hasText: notice.title }).getByRole('button', { name: /공고 핵심만 보기/ });
  await opener.click();
  const panel = page.getByRole('region', { name: '주택형별 공급·분양가', exact: true });
  await panel.getByRole('checkbox', { name: '84A 주택형 비교 선택' }).check();
  await panel.getByRole('checkbox', { name: '59B 주택형 비교 선택' }).check();
  await panel.getByLabel('주택형 정렬').selectOption('PRICE_ASC');
  await expect(panel.getByRole('table', { name: '주택형 공급 목록' }).locator('tbody th').first()).toContainText('59B');
  await expect(panel.getByRole('table', { name: '선택 주택형 비교표', exact: true })).toContainText('기준 대비 −300,000,000원');
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await panel.getByRole('button', { name: '주택형 비교 비우기' }).click();
  await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await expect(opener).toBeFocused();
});

test('상세 일정 모바일: 계약 기간을 선택해 캘린더 파일을 저장하고 초점을 복원한다', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/v1/notices/1', route => route.fulfill({ json: { ...notice, contractStartDate: '2026-10-20', contractEndDate: '2026-10-22' } }));
  await page.goto('/');
  const opener = page.locator('article').filter({ hasText: notice.title }).getByRole('button', { name: /공고 핵심만 보기/ });
  await opener.click();
  const panel = page.getByRole('region', { name: '핵심 일정 타임라인' });
  await panel.getByRole('button', { name: '일정 선택 해제', exact: true }).click();
  await panel.getByRole('checkbox', { name: '계약 기간 일정 선택', exact: true }).check();
  const downloading = page.waitForEvent('download');
  await panel.getByRole('button', { name: '선택 일정 저장 (.ics)', exact: true }).click();
  expect((await downloading).suggestedFilename()).toBe('cheongyak-notice-1-schedule.ics');
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await expect(opener).toBeFocused();
});

test("유형별 최신성: 일부 수집 실패를 최신으로 표시하지 않고 미설정 소스를 구분한다", async ({ page }) => {
  await mockPublicApi(page);
  await page.route("**/api/v1/notices/freshness", route => route.fulfill({ json: {
    generatedAt: "2026-10-06T00:00:00Z", lastCompletedAt: "2026-10-01T00:00:00Z", status: "DELAYED",
    sources: [
      { sourceSystem: "REB_APT", configured: true, status: "FRESH", lastSuccessfulAt: "2026-10-06T00:00:00Z" },
      { sourceSystem: "REB_OFFICETEL", configured: true, status: "DELAYED", lastSuccessfulAt: "2026-10-01T00:00:00Z" },
      { sourceSystem: "MYHOME_PUBLIC_RENTAL", configured: false, status: "UNAVAILABLE", lastSuccessfulAt: null },
    ],
  } }));
  await page.goto("/");
  await expect(page.getByText(/일부 유형 갱신 지연/)).toBeVisible();
  await page.getByText("유형별 수집 현황", { exact: true }).click();
  const panel = page.locator(".source-freshness");
  await expect(panel.getByText("최신", { exact: true })).toHaveCount(1);
  await expect(panel.getByText("갱신 지연", { exact: true })).toHaveCount(1);
  await expect(panel.getByText("수집 미설정", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("필터 결과 이동: 확인은 검색 결과로, 닫기는 원래 버튼으로 초점을 돌린다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockPublicApi(page); await page.goto("/");
  const opener = page.getByRole("button", { name: /청약 필터 열기/ });
  await expect(opener).toBeEnabled();
  await opener.focus(); await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(opener).toBeFocused();
  await opener.press("Enter");
  await dialog.getByRole("button", { name: /공고 .*건 보기/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
});

test("필터 결과 이동: 지연 중에는 오래된 건수 대신 조회 상태를 표시한다", async ({ page }) => {
  await mockPublicApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/notices?**", async route => {
    if (new URL(route.request().url()).searchParams.has("maxPrice")) await gate;
    await route.fallback();
  });
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  await dialog.getByRole("button", { name: "5억 이하", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "검색 중 · 결과 화면 보기" })).toBeVisible();
  await dialog.getByRole("button", { name: "검색 중 · 결과 화면 보기" }).click();
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
  release();
});

test("통합 경계: 0원·0㎡ 상한은 무제한 검색으로 조용히 바뀌지 않는다", async ({ page }) => {
  await mockPublicApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  for (const label of ["예산 최대 (만원)", "면적 최대 (㎡)"]) {
    const input = dialog.getByLabel(label, { exact: true });
    await input.fill("0"); await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("button", { name: /공고 .*건 보기/ })).toBeDisabled();
    await input.fill("");
  }
  await expect(dialog.getByRole("button", { name: /공고 .*건 보기/ })).toBeEnabled();
});

test("통합 경계: 초안에서 빠른 선택으로 이동할 때 중간 검색을 전송하지 않는다", async ({ page }) => {
  const requests = await mockPublicApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  const input = dialog.getByLabel("예산 최소 (만원)", { exact: true });
  await input.fill("30000");
  const preset = dialog.getByRole("button", { name: "5억 이하", exact: true });
  await preset.focus(); await page.waitForTimeout(700); await preset.press("Enter");
  await expect.poll(() => requests.some(q => new URLSearchParams(q).get("maxPrice") === "500000000")).toBe(true);
  expect(requests.some(q => new URLSearchParams(q).has("minPrice"))).toBe(false);
});

test("빠른 범위: 예산 선택은 잘못된 초안을 교체하고 금액과 선택 상태를 유지한다", async ({ page }) => {
  await mockPublicApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  const min = dialog.getByLabel("예산 최소 (만원)", { exact: true });
  await min.fill("-1");
  await expect(dialog.getByRole("alert")).toBeVisible();
  const preset = dialog.getByRole("button", { name: "5억 이하", exact: true });
  await preset.click();
  await expect(min).toHaveValue("");
  await expect(dialog.getByLabel("예산 최대 (만원)", { exact: true })).toHaveValue("50000");
  await expect(preset).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.getByText("입력 금액: 최소 제한 없음 ~ 5억", { exact: true })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("maxPriceManwon")).toBe("50000");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  await expect(preset).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "예산 범위 해제", exact: true }).click();
  await expect(preset).toHaveAttribute("aria-pressed", "false");
});

test("빠른 범위: 공급면적 선택은 이전 상한을 해제하고 모바일 키보드로 조작한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockPublicApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  await dialog.getByRole("button", { name: "85㎡ 이하", exact: true }).click();
  const over = dialog.getByRole("button", { name: "100㎡ 이상", exact: true });
  await over.focus(); await over.press("Enter");
  await expect(dialog.getByLabel("면적 최소 (㎡)", { exact: true })).toHaveValue("100");
  await expect(dialog.getByLabel("면적 최대 (㎡)", { exact: true })).toHaveValue("");
  await expect(over).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("minArea")).toBe("100");
  expect(new URL(page.url()).searchParams.has("maxArea")).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const sizes = await dialog.locator(".range-presets button").evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
  expect(sizes.every(height => height >= 44)).toBe(true);
});

test("범위 필터: 입력 중에는 조회하지 않고 Enter 후 유효한 값만 반영한다", async ({ page }) => {
  const searches = await mockPublicApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  const min = dialog.getByLabel("예산 최소 (만원)", { exact: true });
  await min.fill("30000"); await page.waitForTimeout(700);
  expect(searches.some(q => new URLSearchParams(q).has("minPrice"))).toBe(false);
  await min.press("Enter");
  await expect.poll(() => searches.some(q => new URLSearchParams(q).get("minPrice") === "300000000")).toBe(true);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "예산 범위 해제" }).click();
  await expect(min).toHaveValue("");
  await expect.poll(() => new URL(page.url()).searchParams.has("minPriceManwon")).toBe(false);
});

test("범위 필터: 역전 범위는 조회와 저장을 막고 수정하면 복구한다", async ({ page }) => {
  const searches = await mockPublicApi(page); await page.goto("/?maxArea=84");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  const min = dialog.getByLabel("면적 최소 (㎡)", { exact: true });
  await min.fill("100"); await min.press("Tab");
  await expect(dialog.getByRole("alert")).toContainText("최소값은 최대값보다");
  await expect(dialog.getByRole("button", { name: /공고 .*건 보기/ })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "로그인하고 조건 저장" })).toBeDisabled();
  expect(searches.some(q => new URLSearchParams(q).get("minArea") === "100")).toBe(false);
  await min.fill("59"); await min.press("Enter");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("minArea")).toBe("59");
  await expect(dialog.getByRole("button", { name: /공고 .*건 보기/ })).toBeEnabled();
});

test("범위 필터: 잘못된 초안은 초기화 또는 닫기로 폐기하고 모바일 폭을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 }); await mockPublicApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  const min = dialog.getByLabel("예산 최소 (만원)", { exact: true });
  await min.fill("-1"); await min.press("Enter");
  await expect(min).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(min).toHaveValue("");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await min.fill("1000001");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  await expect(min).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const widths = await dialog.locator(".range-filter input").evaluateAll(inputs => inputs.map(input => input.getBoundingClientRect().width));
  expect(widths.every(width => width >= 90)).toBe(true);
});

async function seedRecentSearches(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("recent-seeded")) return;
    sessionStorage.setItem("recent-seeded", "yes");
    const state = { query: "", region: "서울", status: "all", sort: "LATEST", includeClosed: false };
    localStorage.setItem("cheongyak-one-recent-searches", JSON.stringify([
      { state: { ...state, category: "OFFICETEL", minArea: 20 }, usedAt: 1 },
      { state: { ...state, category: "APARTMENT", minPriceManwon: 100 }, usedAt: 1 },
    ]));
  });
}

test("최근 검색: 같은 지역의 다른 조건을 구분하고 개별 삭제는 현재 검색을 유지한다", async ({ page }) => {
  await mockPublicApi(page); await seedRecentSearches(page);
  await page.goto("/?region=경기");
  await page.getByRole("button", { name: "최근 검색 삭제: 서울 · 오피스텔 · 20~무제한㎡", exact: true }).click();
  await expect(page.getByRole("button", { name: /최근 검색 적용: 서울 · 오피스텔/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /최근 검색 적용: 서울 · 아파트/ })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("region")).toBe("경기");
  await expect(page.getByLabel("청약 검색어", { exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: /최근 검색 적용: 서울 · 오피스텔/ })).toHaveCount(0);
  await page.getByRole("button", { name: /최근 검색 적용: 서울 · 아파트/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("minPriceManwon")).toBe("100");
  expect(new URL(page.url()).searchParams.get("category")).toBe("APARTMENT");
});

test("최근 검색: 모바일 전체 삭제는 키보드 초점을 보존하고 기록을 비운다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockPublicApi(page); await seedRecentSearches(page); await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clear = page.getByLabel("최근 검색", { exact: true }).getByRole("button", { name: "지우기", exact: true });
  await clear.focus(); await page.keyboard.press("Enter");
  await expect(page.getByLabel("최근 검색", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("청약 검색어", { exact: true })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("cheongyak-one-recent-searches"))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("최근 검색: 저장소 실패는 화면 삭제와 영구 삭제를 구분해 안내한다", async ({ page }) => {
  await mockPublicApi(page); await seedRecentSearches(page); await page.goto("/");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  await page.getByRole("button", { name: /최근 검색 삭제: 서울 · 오피스텔/ }).click();
  await expect(page.getByRole("button", { name: /최근 검색 적용: 서울 · 오피스텔/ })).toHaveCount(0);
  await expect(page.getByText(/새로고침하면 다시 나타날 수 있습니다/)).toBeVisible();
});

test("조건 되돌리기: 전체 초기화 후 URL과 모든 조건을 복원한다", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/?q=강남&region=서울&category=OFFICETEL&supplyType=SALE&minPriceManwon=100&maxPriceManwon=200&minArea=20&maxArea=30&includeClosed=true&status=upcoming&sort=DEADLINE");
  const original = [...new URL(page.url()).searchParams.entries()].sort();
  await page.getByRole("button", { name: "검색 조건 전체 초기화", exact: true }).click();
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "검색 조건 되돌리기", exact: true }).click();
  await expect.poll(() => [...new URL(page.url()).searchParams.entries()].sort()).toEqual(original);
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("강남");
  await expect(page.getByRole("button", { name: "검색 조건 되돌리기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
});

test("조건 되돌리기: 연속 해제는 직전 단계만 복원하고 새 입력은 복원을 만료시킨다", async ({ page }) => {
  await mockPublicApi(page);
  await page.goto("/?q=강남&region=서울&minPriceManwon=100&maxPriceManwon=200");
  await page.getByRole("button", { name: "예산 조건 해제", exact: true }).click();
  await page.getByRole("button", { name: "지역: 서울 조건 해제", exact: true }).click();
  await page.getByRole("button", { name: "검색 조건 되돌리기", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("region")).toBe("서울");
  expect(new URL(page.url()).searchParams.has("minPriceManwon")).toBe(false);
  await page.getByRole("button", { name: "지역: 서울 조건 해제", exact: true }).click();
  await page.getByLabel("청약 검색어", { exact: true }).fill("수원");
  await expect(page.getByRole("button", { name: "검색 조건 되돌리기", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("수원");
});

test("조건 되돌리기: 모바일 키보드로 복원 안내를 닫아도 해제된 조건을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockPublicApi(page); await page.goto("/?region=서울");
  await page.getByRole("button", { name: "지역: 서울 조건 해제", exact: true }).click();
  const dismiss = page.getByRole("button", { name: "검색 조건 복원 안내 닫기", exact: true });
  await dismiss.focus(); await page.keyboard.press("Enter");
  await expect(dismiss).toHaveCount(0);
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
  expect(new URL(page.url()).searchParams.has("region")).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("검색 복구: 빈 결과에서 전체 보기로 모든 제한 조건을 해제한다", async ({ page }) => {
  await mockPublicApi(page);
  const requests: URLSearchParams[] = [];
  await page.route("**/api/v1/notices?**", route => {
    const params = new URL(route.request().url()).searchParams;
    requests.push(params);
    const restricted = ["keyword", "region", "category", "supplyType", "minPrice", "maxPrice", "minArea", "maxArea"].some(key => params.has(key));
    return route.fulfill({ json: { content: restricted ? [] : [notice], number: 0, size: 24, totalElements: restricted ? 0 : 1, totalPages: restricted ? 0 : 1 } });
  });
  await page.goto("/?q=없는공고&region=서울&category=OFFICETEL&supplyType=SALE&minPriceManwon=100&maxPriceManwon=200&minArea=20&maxArea=30&includeClosed=true&status=upcoming&sort=DEADLINE");
  await expect(page.getByRole("heading", { name: "조건에 맞는 공고가 없어요" })).toBeVisible();
  await page.getByRole("button", { name: "전체 청약 보기", exact: true }).click();
  await expect(page.getByRole("heading", { name: notice.title, exact: true })).toBeVisible();
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("");
  await expect(page.getByRole("group", { name: "검색 조건 해제" })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe("?sort=DEADLINE");
  expect(requests.some(params => params.get("activeOnly") === "true" && !params.has("minPrice") && !params.has("keyword"))).toBe(true);
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
});

test("검색 복구: 모바일에서 개별 조건만 해제하고 나머지 조건을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockPublicApi(page);
  await page.goto("/?q=강남&region=서울&minPriceManwon=100&maxPriceManwon=200&minArea=20&maxArea=30");
  const controls = page.getByRole("group", { name: "검색 조건 해제" });
  await controls.getByRole("button", { name: "예산 조건 해제", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("minPriceManwon")).toBe(false);
  expect(new URL(page.url()).searchParams.has("maxPriceManwon")).toBe(false);
  expect(new URL(page.url()).searchParams.get("minArea")).toBe("20");
  expect(new URL(page.url()).searchParams.get("region")).toBe("서울");
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("강남");
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const reset = controls.getByRole("button", { name: "검색 조건 전체 초기화" });
  await reset.focus(); await page.keyboard.press("Enter");
  await expect(controls).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).search).toBe("");
});

const notice = { id: 1, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", title: "복구 테스트 공고", regionCode: "서울", address: "서울 강남구", noticeDate: "2026-09-01", applyStartDate: "2026-09-10", applyEndDate: "2026-10-20", winnerAnnounceDate: "2026-10-30", totalUnits: 100, officialUrl: "https://example.com/notice", syncedAt: "2026-10-01T00:00:00Z" };
async function mockPublicApi(page: Page) {
  const searches: string[] = [];
  await page.route("**/api/v1/**", route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/v1/notices") {
      searches.push(url.search);
      return route.fulfill({ json: { content: [notice], number: 0, size: 24, totalElements: 1, totalPages: 1 } });
    }
    if (path.endsWith("/facets")) return route.fulfill({ json: { total: 1, endingToday: 0, open: 1, upcoming: 0 } });
    if (path.endsWith("/freshness")) return route.fulfill({ json: { generatedAt: "2026-10-01T00:00:00Z" } });
    if (path === "/api/v1/notices/1") return route.fulfill({ json: notice });
    if (path.endsWith("/changes")) return route.fulfill({ json: [] });
    return route.fulfill({ status: 401, json: { detail: "로그인이 필요합니다." } });
  });
  return searches;
}

test("복구 브라우저: 오프라인에서 검색을 유지하고 재연결 시 최신 조건으로 조회한다", async ({ page, context }) => {
  const searches = await mockPublicApi(page);
  await page.goto("/?region=서울");
  await expect(page.getByRole("heading", { name: notice.title, exact: true })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("status", { name: "오프라인 안내" })).toBeVisible();
  const count = searches.length;
  await page.getByLabel("청약 검색어", { exact: true }).fill("강남");
  await page.waitForTimeout(900);
  expect(searches.length).toBe(count);
  await expect(page.getByRole("heading", { name: notice.title, exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole("status", { name: "오프라인 안내" })).toHaveCount(0);
  await expect.poll(() => searches.some(query => new URLSearchParams(query).get("keyword") === "강남")).toBe(true);
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("강남");
  expect(new URL(page.url()).searchParams.get("region")).toBe("서울");
});

test("복구 브라우저: 좁은 화면 상세 닫기와 관심 저장이 동작한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockPublicApi(page); await page.goto("/");
  const card = page.locator("article").filter({ hasText: notice.title });
  await card.getByLabel(/관심청약 저장/).click();
  await card.getByRole("button", { name: /공고 핵심만 보기/ }).click();
  const dialog = page.getByRole("dialog", { name: notice.title });
  await expect(dialog).toBeVisible(); await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(card.getByRole("button", { name: /공고 핵심만 보기/ })).toBeFocused();
  await page.reload(); await expect(card.getByLabel(/관심청약 해제/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("복구 브라우저: 예약된 자동 재시도는 오프라인 동안 중단된다", async ({ page, context }) => {
  await mockPublicApi(page);
  let requests = 0;
  await page.route("**/api/v1/notices?**", route => {
    requests++;
    return route.fulfill({ status: 503, json: { detail: "temporary unavailable" } });
  });
  await page.goto("/");
  await expect(page.getByText(/서버에 연결하지 못했어요/)).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("status", { name: "오프라인 안내" })).toBeVisible();
  const before = requests;
  await page.waitForTimeout(4100);
  expect(requests).toBe(before);
  await expect(page.getByRole("status", { name: "청약 공고 불러오는 중" })).toHaveCount(0);
  await expect(page.getByText("연결 후 현재 검색조건의 공고를 확인할 수 있습니다.")).toBeVisible();
  await context.setOffline(false);
  await expect.poll(() => requests).toBeGreaterThan(before);
});

test("복구 브라우저: 렌더 오류 안내에서 복구해도 저장소와 URL을 삭제하지 않는다", async ({ page }) => {
  // Replace only the child module in the development server, exercising the real root boundary.
  await page.route(/\/src\/App\.tsx(?:\?.*)?$/, route => route.fulfill({ contentType: "application/javascript", body:
    'import React from "/node_modules/.vite/deps/react.js"; export default function App(){ if(!window.__recovered) throw new Error("private-error"); return React.createElement("h1", null, "화면 복구 성공"); }' }));
  await page.addInitScript(() => localStorage.setItem("cheongyak-one-saved", "[1]"));
  await page.goto("/?region=서울");
  await expect(page.getByRole("heading", { name: "화면을 표시하지 못했어요" })).toBeFocused();
  await expect(page.getByText("private-error", { exact: true })).toHaveCount(0);
  await page.evaluate(() => { (window as any).__recovered = true; });
  await page.getByRole("button", { name: "화면 다시 시도", exact: true }).click();
  await expect(page.getByRole("heading", { name: "화면 복구 성공" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("cheongyak-one-saved"))).toBe("[1]");
  expect(new URL(page.url()).searchParams.get("region")).toBe("서울");
});

test("요청 복구: 닫힌 상세의 늦은 응답은 다시 연 상세를 덮어쓰지 않는다", async ({ page }) => {
  await mockPublicApi(page);
  let pending: Route | undefined; let calls = 0;
  await page.route("**/api/v1/notices/1", route => {
    if (++calls === 1) { pending = route; return; }
    return route.fulfill({ json: { ...notice, title: "최신 상세 공고" } });
  });
  await page.goto("/");
  const open = page.locator("article").getByRole("button", { name: /공고 핵심만 보기/ });
  await open.click(); await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole("dialog").getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/notice=/);
  await open.click();
  await expect(page.getByRole("dialog", { name: "최신 상세 공고" })).toBeVisible();
  await pending!.fulfill({ json: { ...notice, title: "이전 상세 응답" } });
  await page.waitForTimeout(200);
  await expect(page.getByRole("dialog", { name: "최신 상세 공고" })).toBeVisible();
  await expect(page.getByText("이전 상세 응답", { exact: true })).toHaveCount(0);
});

test("요청 복구: 상세 오류는 요약을 유지하고 같은 창에서 다시 불러온다", async ({ page }) => {
  await mockPublicApi(page); let calls = 0;
  await page.route("**/api/v1/notices/1", route => ++calls === 1
    ? route.fulfill({ status: 503, json: { detail: "일시적인 상세 오류" } })
    : route.fulfill({ json: { ...notice, title: "복구된 상세" } }));
  await page.goto("/");
  await page.locator("article").getByRole("button", { name: /공고 핵심만 보기/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("목록의 요약");
  await dialog.getByRole("button", { name: "상세 다시 불러오기" }).click();
  await expect(page.getByRole("dialog", { name: "복구된 상세" })).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  expect(calls).toBe(2);
});

test("요청 복구: 더보기 중 정렬 변경은 이전 페이지와 중복 요청을 차단한다", async ({ page }) => {
  await mockPublicApi(page); let pending: Route | undefined; let moreCalls = 0;
  await page.route("**/api/v1/notices?**", route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("page") === "1") { moreCalls++; pending = route; return; }
    const sorted = url.searchParams.get("sort") === "DEADLINE";
    return route.fulfill({ json: { content: [{ ...notice, title: sorted ? "새 정렬 결과" : notice.title }], number: 0, size: 1, totalElements: 2, totalPages: 2 } });
  });
  await page.goto("/");
  const more = page.getByRole("button", { name: /건 더보기/ });
  await more.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => moreCalls).toBe(1);
  await page.getByLabel("청약 공고 정렬").selectOption("DEADLINE");
  await expect(page.getByRole("heading", { name: "새 정렬 결과", exact: true })).toBeVisible();
  await pending!.fulfill({ json: { content: [{ ...notice, id: 2, title: "이전 페이지 공고" }], number: 1, size: 1, totalElements: 2, totalPages: 2 } });
  await page.waitForTimeout(200);
  await expect(page.getByText("이전 페이지 공고", { exact: true })).toHaveCount(0);
  await expect(more).toBeEnabled(); expect(moreCalls).toBe(1);
});

test("목록 탐색: 더보기 실패 후 재시도는 목록을 유지하고 중복 공고 없이 이동한다", async ({ page }) => {
  await mockPublicApi(page); let attempts = 0;
  await page.route("**/api/v1/notices?**", route => {
    const isMore = new URL(route.request().url()).searchParams.get("page") === "1";
    if (isMore && ++attempts === 1) return route.fulfill({ status: 503, json: { detail: "잠시 후 다시 시도해주세요." } });
    return route.fulfill({ json: isMore
      ? { content: [notice, { ...notice, id: 2, title: "추가 공고" }], number: 1, size: 2, totalElements: 2, totalPages: 2 }
      : { content: [notice], number: 0, size: 1, totalElements: 3, totalPages: 3 } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /건 더보기/ }).click();
  await expect(page.getByRole("alert")).toContainText("현재 목록은 유지됩니다.");
  await expect(page.getByRole("article", { name: notice.title })).toHaveCount(1);
  await page.getByRole("button", { name: "다음 공고 다시 불러오기" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("공고 1건을 추가로 불러왔습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "새로 불러온 공고로 이동" }).click();
  await expect(page.getByRole("article", { name: "추가 공고", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "추가 조회 완료" })).toBeDisabled();
  expect(attempts).toBe(2);
});

test("목록 탐색: 더보기 오류는 조건 변경 시 지워진다", async ({ page }) => {
  await mockPublicApi(page);
  await page.route("**/api/v1/notices?**", route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("page") === "1") return route.fulfill({ status: 500, json: { detail: "이전 조건 오류" } });
    return route.fulfill({ json: { content: [notice], number: 0, size: 1, totalElements: 2, totalPages: 2 } });
  });
  await page.goto("/"); await page.getByRole("button", { name: /건 더보기/ }).click();
  await expect(page.getByRole("alert")).toContainText("이전 조건 오류");
  await page.getByLabel("청약 공고 정렬").selectOption("DEADLINE");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /건 더보기/ })).toBeEnabled();
});

test("목록 탐색: 빈 추가 페이지는 반복 요청 대신 목록 새로고침을 제공한다", async ({ page }) => {
  await mockPublicApi(page); let moreCalls = 0;
  await page.route("**/api/v1/notices?**", route => {
    const isMore = new URL(route.request().url()).searchParams.get("page") === "1";
    if (isMore) moreCalls++;
    return route.fulfill({ json: { content: isMore ? [] : [notice], number: isMore ? 1 : 0, size: 1, totalElements: 9, totalPages: 9 } });
  });
  await page.goto("/"); await page.getByRole("button", { name: /건 더보기/ }).click();
  await expect(page.getByText(/추가로 표시할 공고가 없습니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "추가 조회 완료" })).toBeDisabled();
  await page.getByRole("button", { name: "목록 새로고침", exact: true }).click();
  await expect(page.getByText(/추가로 표시할 공고가 없습니다/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /건 더보기/ })).toBeEnabled();
  expect(moreCalls).toBe(1);
});

test("목록 탐색: 모바일 관심 메뉴는 검색 결과로 키보드 초점을 옮긴다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await mockPublicApi(page); await page.goto("/");
  await expect(page.getByRole("article", { name: notice.title })).toBeVisible();
  await page.getByRole("navigation", { name: "모바일 메뉴" }).getByRole("button", { name: "관심", exact: true }).click();
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('현금 계획 모바일: 계산·입력 수정·닫기 후 포커스 복원', async ({ page }) => {
  await mockPublicApi(page);
  await page.route('**/api/v1/notices/1', route => route.fulfill({ json: { ...notice, unitTypes: [{ modelId: 'A', housingTypeName: '084A', maxPrice: 600000000 }] } }));
  await page.goto('/');
  const opener = page.locator('article').filter({ hasText: notice.title }).getByRole('button', { name: /공고 핵심만 보기/ });
  await opener.click();
  const panel = page.getByRole('region', { name: '주택형별 필요 현금 계산기', exact: true });
  await panel.getByLabel('계산할 주택형', { exact: true }).selectOption('0');
  for (const [label, value] of [['계약금 비율 (%)', '10'], ['중도금 비율 (%)', '60'], ['중도금 대출 예상액 (원)', '0'], ['잔금 시 총 대출 예상액 (원)', '0'], ['추가 비용 예상액 (원)', '0'], ['현재 준비한 현금 (원)', '600000000']]) await panel.getByLabel(label, { exact: true }).fill(value);
  await panel.getByRole('button', { name: '현금 계획 계산', exact: true }).click();
  const result = panel.getByRole('region', { name: '현금 계획 결과' });
  await expect(result.getByRole('heading', { level: 4 })).toContainText('600,000,000원');
  await result.getByRole('button', { name: '비교에 담기', exact: true }).click();
  await expect(panel.getByRole('heading', { name: '현금 계획 비교 · 1/3개', exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', { name: '비교 내역 파일 저장', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('cheongyak-cash-plan-1.txt');
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await panel.getByLabel('중도금 비율 (%)', { exact: true }).fill('101');
  await expect(result).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await expect(opener).toBeFocused();
});


for (const field of ["businessEntityName", "address", "applyStartDate", "syncedAt"]) {
  test(`캐시 복구: 잘못된 ${field} 값을 버리고 최신 목록으로 복구한다`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await mockPublicApi(page);
    await page.goto("/?region=서울");
    await expect(page.getByRole("heading", { name: notice.title, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() =>
      Object.keys(sessionStorage).filter(key => key.startsWith("cheongyak-one-notice-page:v2:")).length,
    )).toBeGreaterThan(0);
    const activeCacheKey = await page.evaluate(() => Object.keys(sessionStorage).find(key =>
      key.startsWith("cheongyak-one-notice-page:v2:") && JSON.parse(key.slice("cheongyak-one-notice-page:v2:".length)).activeOnly === true));
    expect(activeCacheKey).toBeTruthy();
    await page.addInitScript(({ field }) => {
      for (const key of Object.keys(sessionStorage)) {
        if (!key.startsWith("cheongyak-one-notice-page:v2:")) continue;
        const entry = JSON.parse(sessionStorage.getItem(key)!);
        entry.page.content = entry.page.content.map((row: Record<string, unknown>) => ({ ...row, [field]: field === "syncedAt" ? "bad" : { invalid: true } }));
        sessionStorage.setItem(key, JSON.stringify(entry));
      }
      localStorage.setItem("cache-recovery-unrelated", "keep");
    }, { field });
    let release!: () => void;
    const responseReady = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/v1/notices?**", async route => {
      await responseReady;
      await route.fulfill({ json: { content: [notice], number: 0, size: 12, totalElements: 1, totalPages: 1 } });
    });
    try {
      await page.reload();
      await expect(page.getByRole("status", { name: "청약 공고 불러오는 중" })).toBeVisible();
      // Only the selected tab is read before the first successful response.
      await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key!), activeCacheKey)).toBeNull();
      await expect(page.getByRole("heading", { name: "화면을 표시하지 못했어요" })).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page.getByRole("heading", { name: notice.title, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key!) ?? "null")?.page.content[0]?.title, activeCacheKey)).toBe(notice.title);
    // The successful cache write also prunes corrupt inactive tab entries.
    await expect.poll(() => page.evaluate(field => Object.keys(sessionStorage)
      .filter(key => key.startsWith("cheongyak-one-notice-page:v2:"))
      .every(key => JSON.parse(sessionStorage.getItem(key)!).page.content.every((row: Record<string, unknown>) =>
        field === "syncedAt" ? typeof row[field] === "string" && Number.isFinite(Date.parse(row[field] as string))
          : row[field] == null || typeof row[field] === "string")), field)).toBe(true);
    expect(new URL(page.url()).searchParams.get("region")).toBe("서울");
    expect(await page.evaluate(() => localStorage.getItem("cache-recovery-unrelated"))).toBe("keep");
    expect(errors).toEqual([]);
  });
}


test("날짜 표시: 잘못된 상세 일정과 변경 시각에도 화면을 유지한다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await mockPublicApi(page);
  await page.route("**/api/v1/notices/1", route => route.fulfill({ json: {
    ...notice, applyStartDate: "bad", applyEndDate: "2026-02-30",
    noticeDate: "2026-13-01", winnerAnnounceDate: "bad",
    contentChangedAt: "bad", lastChangeSummary: "일정 자료 확인 필요",
    specialSupplyStartDate: "2026-02-30", specialSupplyEndDate: "2026-03-02",
  } }));
  await page.goto("/");
  const open = page.locator("article").filter({ hasText: notice.title }).getByRole("button", { name: /공고 핵심만 보기/ });
  await open.click();
  const dialog = page.getByRole("dialog", { name: notice.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("변경 시각 미확인", { exact: false })).toBeVisible();
  await expect(dialog.locator(".detail-status")).toContainText("일정 확인");
  await expect(dialog.locator(".detail-status")).toContainText("세부 일정은 공고문 확인");
  await expect(dialog).not.toContainText("NaN");
  await expect(page.getByRole("heading", { name: "화면을 표시하지 못했어요" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(errors).toEqual([]);
});

test("날짜 표시: 시작일이 없어도 상세에서 확인된 접수 마감일을 안내한다", async ({ page }) => {
  await mockPublicApi(page);
  await page.route("**/api/v1/notices/1", route => route.fulfill({ json: {
    ...notice, applyStartDate: null, applyEndDate: "2026-10-20", winnerAnnounceDate: "2026-10-30",
  } }));
  await page.goto("/");
  await page.locator("article").filter({ hasText: notice.title }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
  const dialog = page.getByRole("dialog", { name: notice.title });
  await expect(dialog.locator(".detail-status")).toContainText("10. 20. 접수 마감");
  await expect(dialog.locator(".detail-status")).not.toContainText("당첨 발표");
});


test("지연된 목록: 모바일에서 기다리지 않고 필터를 열어 새 조건으로 조회한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await mockPublicApi(page);
  const pending: Route[] = [];
  let newConditionRequests = 0;
  await page.route("**/api/v1/notices?**", route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("region") !== "부산") { pending.push(route); return; }
    newConditionRequests++;
    return route.fulfill({ json: { content: [{ ...notice, title: "새 조건 부산 공고", regionCode: "부산", address: "부산 해운대구" }], number: 0, size: 12, totalElements: 1, totalPages: 1 } });
  });
  await page.goto("/");
  await expect.poll(() => pending.length).toBe(1);
  await expect(page.getByRole("status", { name: "청약 공고 불러오는 중" })).toBeVisible();
  const filterButton = page.getByRole("button", { name: /청약 필터 열기/ });
  await expect(filterButton).toBeEnabled();
  await filterButton.click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  await expect(dialog).toBeVisible();
  const cancelled = page.waitForEvent("requestfailed", request => request === pending[0].request());
  await dialog.getByRole("button", { name: "부산", exact: true }).click();
  await cancelled;
  await expect.poll(() => newConditionRequests).toBeGreaterThan(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("region")).toBe("부산");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "새 조건 부산 공고", exact: true })).toBeVisible();
  // A canceled initial request must neither spawn prefetches nor replace the new condition.
  for (const route of pending) await route.fulfill({ json: { content: [{ ...notice, title: "이전 조건 공고" }], number: 0, size: 12, totalElements: 1, totalPages: 1 } });
  await expect(page.getByRole("heading", { name: "새 조건 부산 공고", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage)
    .filter(key => key.startsWith("cheongyak-one-notice-page:v2:"))
    .some(key => sessionStorage.getItem(key)?.includes("이전 조건 공고")))).toBe(false);
  await expect(page.getByRole("heading", { name: "새 조건 부산 공고", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이전 조건 공고", exact: true })).toHaveCount(0);
  await expect(filterButton).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("동기화 시각: 잘못된 목록·최신성·소스 시각에도 탐색과 재검색을 유지한다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await mockPublicApi(page);
  const searches: string[] = [];
  await page.route("**/api/v1/notices?**", route => {
    const params = new URL(route.request().url()).searchParams;
    searches.push(new URL(route.request().url()).search);
    const title = params.get("keyword") === "강남" ? "재검색 강남 공고" : notice.title;
    return route.fulfill({ json: { content: [{ ...notice, title, syncedAt: "bad" }], number: 0, size: 12, totalElements: 1, totalPages: 1 } });
  });
  let freshness: Route | undefined;
  await page.route("**/api/v1/notices/freshness", route => { freshness = route; });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: notice.title, exact: true })).toBeVisible();
  await expect(page.locator(".data-note")).toContainText("시각 미확인");
  await expect.poll(() => Boolean(freshness)).toBe(true);
  await freshness!.fulfill({ json: {
    status: "FRESH", generatedAt: "2026-10-09T00:00:00Z", lastCompletedAt: "bad",
    sources: [{ sourceSystem: "REB_APT", configured: true, status: "FRESH", lastSuccessfulAt: "bad" }],
  } });
  const sources = page.locator(".source-freshness");
  await sources.getByText("유형별 수집 현황", { exact: true }).click();
  await expect(sources).toContainText("마지막 성공: 시각 미확인");
  await expect(page.locator(".data-note")).toContainText("시각 미확인");
  await page.getByLabel("청약 검색어", { exact: true }).fill("강남");
  await expect.poll(() => searches.some(query => new URLSearchParams(query).get("keyword") === "강남")).toBe(true);
  await expect(page.getByRole("heading", { name: "재검색 강남 공고", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: notice.title, exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "화면을 표시하지 못했어요" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("목록 우선 조회: 실패 중 사전 요청을 막고 성공 후 탭 캐시를 준비한다", async ({ page }) => {
  await mockPublicApi(page);
  const requests: Route[] = [];
  let revalidating: Route | undefined;
  let holdOpen = false;
  await page.route("**/api/v1/notices?**", route => {
    requests.push(route);
    if (requests.length === 1) return;
    const isOpen = new URL(route.request().url()).searchParams.get("status") === "OPEN";
    if (isOpen && holdOpen) { revalidating = route; return; }
    return route.fulfill({ json: { content: [{ ...notice, title: isOpen ? "미리 읽은 접수중 공고" : notice.title }], number: 0, size: 12, totalElements: 1, totalPages: 1 } });
  });
  await page.goto("/");
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByRole("status", { name: "청약 공고 불러오는 중" })).toBeVisible();
  await requests[0].fulfill({ status: 503, json: { detail: "temporary unavailable" } });
  await expect(page.getByText(/서버에 연결하지 못했어요/)).toBeVisible();
  expect(requests.length).toBe(1);
  await expect.poll(() => requests.length).toBe(5);
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).some(key => sessionStorage.getItem(key)?.includes("미리 읽은 접수중 공고")))).toBe(true);
  holdOpen = true;
  await page.getByRole("tab", { name: /접수중/ }).click();
  await expect.poll(() => Boolean(revalidating)).toBe(true);
  await expect(page.getByRole("heading", { name: "미리 읽은 접수중 공고", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "청약 공고 불러오는 중" })).toHaveCount(0);
  await revalidating!.fulfill({ json: { content: [notice], number: 0, size: 12, totalElements: 1, totalPages: 1 } });
});

test("탐색 복원: 뒤로가기와 앞으로가기에 예산·면적·검색어를 함께 복원한다", async ({ page }) => {
  const searches = await mockPublicApi(page);
  await page.goto("/?q=서울&minPriceManwon=30000&maxPriceManwon=60000&minArea=59&maxArea=84");
  await expect(page.getByRole("heading", { name: notice.title, exact: true })).toBeVisible();
  await page.evaluate(() => {
    history.pushState(null, "", "/?q=부산&minPriceManwon=10000&maxPriceManwon=40000&minArea=30&maxArea=60");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect.poll(() => searches.some(q => {
    const p = new URLSearchParams(q);
    return p.get("keyword") === "부산" && p.get("minPrice") === "100000000" && p.get("maxArea") === "60";
  })).toBe(true);
  await page.goBack();
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("서울");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  await expect(dialog.getByLabel("예산 최소 (만원)", { exact: true })).toHaveValue("30000");
  await expect(dialog.getByLabel("예산 최대 (만원)", { exact: true })).toHaveValue("60000");
  await expect(dialog.getByLabel("면적 최소 (㎡)", { exact: true })).toHaveValue("59");
  await expect(dialog.getByLabel("면적 최대 (㎡)", { exact: true })).toHaveValue("84");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.goForward();
  await expect(page.getByLabel("청약 검색어", { exact: true })).toHaveValue("부산");
  await expect.poll(() => new URL(page.url()).searchParams.get("minPriceManwon")).toBe("10000");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  await expect(dialog.getByLabel("면적 최대 (㎡)", { exact: true })).toHaveValue("60");
});

test("탐색 복원: 관심 목록에서 상세 닫기·뒤로가기 후 목록과 초점을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const searches = await mockPublicApi(page);
  await page.goto("/");
  const card = page.locator("#notice-card-1");
  await card.getByLabel(/관심청약 저장/).click();
  const favorites = page.getByRole("button", { name: "관심청약 1개", exact: true });
  await favorites.click();
  await expect(favorites).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => searches.some(q => new URLSearchParams(q).has("ids"))).toBe(true);
  const opener = card.getByRole("button", { name: "공고 핵심만 보기", exact: true });
  const count = searches.length;
  await opener.click();
  const dialog = page.getByRole("dialog", { name: notice.title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(favorites).toHaveAttribute("aria-pressed", "true");
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(favorites).toHaveAttribute("aria-pressed", "true");
  await expect(opener).toBeFocused();
  expect(searches.length).toBe(count);
});
