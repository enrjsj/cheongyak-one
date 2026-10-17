import { expect, test, type Page, type Route } from "@playwright/test";

const member = { id: 42, nickname: "입력 회원", email: "input@example.invalid", role: "MEMBER", emailVerified: true };
const profile = { id: 11, name: "소수 면적 조건", status: "ALL", sort: "LATEST", minArea: 59.5, maxArea: 84.99, defaultProfile: false, newNoticeEnabled: false, updatedAt: "2026-10-17T00:00:00Z" };
const notice = { id: 1, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", title: "면적 검증 공고", regionCode: "서울", address: "서울", applyStartDate: "2026-10-01", applyEndDate: "2026-10-30", noticeDate: "2026-10-01", syncedAt: "2026-10-01T00:00:00Z" };
async function mockApi(page: Page) {
  const requests: URL[] = [];
  await page.route("**/api/v1/**", route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (path === "/api/v1/notices" || path.endsWith("/facets")) requests.push(url);
    if (path === "/api/v1/notices") return route.fulfill({ json: { content: [notice], number: 0, size: 12, totalElements: 1, totalPages: 1 } });
    if (path.endsWith("/facets")) return route.fulfill({ json: { total: 1, open: 1, endingToday: 0, upcoming: 0 } });
    if (path.endsWith("/freshness")) return route.fulfill({ json: { generatedAt: "2026-10-17T00:00:00Z" } });
    if (path === "/api/v1/members/me") return route.fulfill({ json: member });
    if (path.endsWith("/favorites") || path.endsWith("/comparisons")) return route.fulfill({ json: { noticeIds: [] } });
    if (path.endsWith("/tracker")) return route.fulfill({ json: [] });
    if (path.endsWith("/saved-search-profiles")) return route.fulfill({ json: [profile] });
    if (path.endsWith("/search-preference") || path.endsWith("/eligibility-profile")) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 404 });
  });
  return requests;
}

test("소수 면적 입력·API·URL·새로고침·최근 검색이 같은 값을 보존한다", async ({ page }) => {
  const requests = await mockApi(page);
  await page.goto("/?minArea=59.5&maxArea=84.99");
  await expect.poll(() => requests.filter(url => url.pathname.endsWith("/notices") && url.searchParams.get("minArea") === "59.5" && url.searchParams.get("maxArea") === "84.99").length).toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const filter = page.getByRole("dialog", { name: "청약 조건 선택", exact: true });
  const min = filter.getByRole("textbox", { name: "면적 최소 (㎡)", exact: true });
  await expect(min).toHaveValue("59.5");
  await min.click(); await min.fill("60."); await expect(min).toHaveValue("60.");
  await expect(min).toHaveAttribute("aria-invalid", "true");
  await min.fill("60.01"); await min.press("Enter");
  await expect(page).toHaveURL(/minArea=60.01/);
  await expect.poll(() => requests.filter(url => url.pathname.endsWith("/facets") && url.searchParams.get("minArea") === "60.01").length).toBeGreaterThan(0);
  await filter.getByRole("button", { name: /^공고 1건 보기$/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.reload(); await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  await expect(min).toHaveValue("60.01");
  await expect(filter.getByRole("textbox", { name: "면적 최대 (㎡)", exact: true })).toHaveValue("84.99");
  const recent = await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes("recent-search")).map(([, value]) => value).join(""));
  expect(recent).toContain('"minArea":60.01');
});

test("최소 면적 0은 API와 새로고침에서 모두 제한 없음으로 유지한다", async ({ page }) => {
  const requests = await mockApi(page); await page.goto("/");
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  const filter = page.getByRole("dialog", { name: "청약 조건 선택", exact: true });
  const min = filter.getByRole("textbox", { name: "면적 최소 (㎡)", exact: true });
  await min.fill("0"); await min.press("Enter");
  await filter.getByRole("button", { name: /^공고 1건 보기$/ }).click();
  await expect(page).not.toHaveURL(/minArea=/);
  await page.reload(); await expect(page.getByRole("article", { name: notice.title, exact: true })).toBeVisible();
  expect(requests.some(url => url.searchParams.has("minArea"))).toBe(false);
});

test("저장조건 편집은 소수 초안을 보존하고 저장 중 잠금·실패 후 재시도를 지원한다", async ({ page }) => {
  await mockApi(page); let row = { ...profile }; const pending: Route[] = [];
  await page.route("**/members/me/saved-search-profiles", route => route.fulfill({ json: [row] }));
  await page.route("**/saved-search-profiles/11", route => { pending.push(route); });
  await page.goto("/"); await expect(page.getByRole("button", { name: member.nickname, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  await page.getByRole("region", { name: "저장 검색조건 관리" }).getByRole("button", { name: "수정", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "저장 조건 수정", exact: true });
  const min = editor.getByLabel("최소 면적 (㎡)", { exact: true });
  await min.click(); await min.fill("60."); await expect(min).toHaveValue("60.");
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("소수 둘째 자리"); expect(pending).toHaveLength(0);
  await min.fill("60.01"); await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  expect(pending[0].request().postDataJSON()).toMatchObject({ minArea: 60.01, maxArea: 84.99 });
  await expect(min).toBeDisabled(); await expect(editor.getByLabel("조건 이름", { exact: true })).toBeDisabled();
  await expect(editor.getByRole("button", { name: "닫기", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(editor).toBeVisible();
  await pending[0].fulfill({ status: 503 });
  await expect(min).toBeEnabled(); await expect(min).toHaveValue("60.01");
  await editor.getByRole("button", { name: "저장 목록 다시 확인" }).click();
  await expect(editor.getByRole("button", { name: "저장", exact: true })).toBeEnabled();
  await editor.getByRole("button", { name: "저장", exact: true }).click();
  await expect.poll(() => pending.length).toBe(2);
  row = { ...row, ...pending[1].request().postDataJSON() };
  await pending[1].fulfill({ json: row }); await expect(editor).toHaveCount(0);
  await page.getByRole("region", { name: "저장 검색조건 관리" }).getByRole("button", { name: "적용", exact: true }).click();
  await expect(page).toHaveURL(/minArea=60.01/);
});
