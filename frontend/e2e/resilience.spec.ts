import { test, expect, type Page } from "@playwright/test";

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
