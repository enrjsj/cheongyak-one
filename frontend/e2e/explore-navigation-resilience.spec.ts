import { expect, test, type Page, type Route } from "@playwright/test";

const rows = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, title: `탐색 공고 ${index + 1}`, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", regionCode: "서울", address: "서울특별시", applyStartDate: "2026-10-01", applyEndDate: "2026-10-31", syncedAt: "2026-10-19T00:00:00Z" }));
const result = (content = rows) => ({ content, number: 0, size: 24, totalElements: content.length, totalPages: content.length ? 1 : 0 });

async function setup(page: Page, openReply?: (route: Route) => unknown) {
  const requests: URL[] = [];
  await page.route("**/api/v1/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/notices") {
      requests.push(url);
      if (url.searchParams.get("status") === "OPEN" && openReply) return openReply(route);
      return route.fulfill({ json: result() });
    }
    if (url.pathname.endsWith("/facets")) return route.fulfill({ json: { total: 8, open: 8, endingToday: 1, upcoming: 2 } });
    if (url.pathname.endsWith("/freshness")) return route.fulfill({ json: {} });
    return route.fulfill({ status: 401 });
  });
  await page.goto("/");
  await expect(page.locator(".application-card")).toHaveCount(8);
  return requests;
}

async function expectResultsVisible(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const results = document.getElementById("notice-results")!.getBoundingClientRect();
    const tabs = document.querySelector(".status-tabs")!.getBoundingClientRect();
    return results.top >= tabs.bottom && results.top <= tabs.bottom + 30 && results.top < innerHeight / 2;
  })).toBe(true);
}

for (const width of process.env.IPHONE_TEST ? [320, 390] : [320, 390, 1440]) {
  test(`탐색 이동 ${width}px: 상태 클릭은 공고를 메뉴 아래에 노출하고 같은 탭 재선택도 이동한다`, async ({ page, hasTouch }) => {
    await page.setViewportSize({ width, height: 844 });
    await setup(page);
    const tabs = page.getByRole("tablist", { name: "청약 상태" });
    for (const name of ["오늘 마감", "접수중", "오픈 예정", "모집 중·예정"]) {
      await page.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }));
      const tab = tabs.getByRole("tab", { name: new RegExp(name) });
      if (hasTouch) await tab.tap(); else await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expectResultsVisible(page);
      await expect(tab).toBeFocused();
    }
    await page.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }));
    await tabs.getByRole("tab", { name: /모집 중·예정/ }).click();
    await expectResultsVisible(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/explore-navigation-${width}.png` });
  });
}

test("탐색 이동: 연속 키보드 선택과 모션 줄이기를 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.evaluate(() => {
    const original = window.scrollTo.bind(window);
    (window as Window & { resultScrolls?: ScrollToOptions[] }).resultScrolls = [];
    window.scrollTo = ((options: ScrollToOptions) => {
      (window as Window & { resultScrolls: ScrollToOptions[] }).resultScrolls.push(options);
      original(options);
    }) as typeof window.scrollTo;
  });
  const tabs = page.getByRole("tablist", { name: "청약 상태" });
  await tabs.getByRole("tab", { name: /모집 중·예정/ }).click();
  for (const [key, name] of [["ArrowRight", "오늘 마감"], ["ArrowRight", "접수중"], ["End", "오픈 예정"], ["Home", "모집 중·예정"]]) {
    await page.keyboard.press(key);
    await expect(tabs.getByRole("tab", { name: new RegExp(name) })).toBeFocused();
    await expectResultsVisible(page);
  }
  const calls = await page.evaluate(() => (window as Window & { resultScrolls: ScrollToOptions[] }).resultScrolls);
  expect(calls.length).toBeGreaterThanOrEqual(5);
  expect(calls.every(call => call.behavior === "instant")).toBe(true);
});

test("탐색 이동: 응답을 기다리지 않고 이동하며 늦은 응답은 다시 스크롤하지 않는다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pending: Route[] = [];
  await setup(page, route => { pending.push(route); });
  await page.getByRole("tab", { name: /접수중/ }).click();
  await expect(page.getByRole("status", { name: "청약 공고 불러오는 중" })).toBeVisible();
  await expectResultsVisible(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await Promise.all(pending.map(route => route.fulfill({ json: result() }).catch(() => {})));
  await expect(page.locator(".application-card")).toHaveCount(8);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

for (const failure of [false, true]) test(`탐색 이동: ${failure ? "조회 실패" : "0건"} 안내도 결과 위치에서 확인한다`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page, route => route.fulfill(failure ? { status: 400, json: { detail: "조회 조건 확인 필요" } } : { json: result([]) }));
  await page.getByRole("tab", { name: /접수중/ }).click();
  await expectResultsVisible(page);
  await expect(page.locator("#notice-results").getByRole("heading", { name: failure ? "공고를 불러오지 못했어요" : "조건에 맞는 공고가 없어요" })).toBeVisible();
});

test("탐색 정리: 빠른 검색 없이 기존 검색 조건을 유지하고 결과로 이동한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests = await setup(page);
  await expect(page.locator(".quick-filters")).toHaveCount(0);
  await expect(page.getByText("빠른 검색", { exact: true })).toHaveCount(0);
  await page.getByLabel("청약 검색어", { exact: true }).fill("서울");
  await page.getByLabel("목록 지역 필터", { exact: true }).selectOption("서울");
  await page.getByLabel("목록 주택 유형 필터", { exact: true }).selectOption("아파트");
  await page.getByRole("button", { name: "청약 찾기", exact: true }).click();
  await expectResultsVisible(page);
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
  await expect.poll(() => requests.some(url => url.searchParams.get("keyword") === "서울" && url.searchParams.get("region") === "서울" && url.searchParams.get("category") === "APARTMENT")).toBe(true);
});

test("모바일 필터: 결과보기는 스크롤 없이 찾고 닫기와 결과 이동의 초점을 구분한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page);
  const opener = page.getByRole("button", { name: /청약 필터 열기/ });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "청약 조건 선택" });
  const view = dialog.getByRole("button", { name: /공고 .*건 보기/ });
  await expect(view).toBeInViewport();
  await expect.poll(() => dialog.evaluate(element => element.scrollTop)).toBe(0);
  await dialog.getByRole("button", { name: "서울", exact: true }).click();
  const maximum = dialog.getByLabel("면적 최대 (㎡)", { exact: true });
  await maximum.click();
  await maximum.fill("84.5");
  await expect(maximum).toHaveValue("84.5");
  expect(await maximum.evaluate(element => {
    const box = element.getBoundingClientRect();
    const footer = element.closest(".filter-modal")!.querySelector(".modal-actions")!.getBoundingClientRect();
    return box.bottom <= footer.top && element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  })).toBe(true);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(view).toBeInViewport();
  await view.click();
  await expect(dialog).toHaveCount(0);
  await expectResultsVisible(page);
  await expect(page.getByRole("region", { name: "청약 검색 결과", exact: true })).toBeFocused();
});
