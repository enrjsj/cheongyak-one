import { test, expect, type Page, type Route } from "@playwright/test";

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
