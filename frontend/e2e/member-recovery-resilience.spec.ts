import { expect, test, type Page, type Route } from "@playwright/test";

const profile = { id: 42, nickname: "저장 회원", email: "recovery@example.invalid", role: "MEMBER", emailVerified: true };
const notices = [1, 2].map(id => ({ id, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", title: `복구 공고 ${id}`, regionCode: "서울", address: "서울특별시", noticeDate: "2026-10-01", applyStartDate: "2026-10-01", applyEndDate: "2026-10-30", totalUnits: 10, officialUrl: "https://example.invalid/notice", syncedAt: "2026-10-01T00:00:00Z" }));
const tracker = (id: number) => ({ noticeId: id, progress: "SAVED", memo: `기존 메모 ${id}`, applicationResult: "PENDING", applicationResultMemo: "", noticeDocumentChecked: true, eligibilityChecked: false, scheduleChecked: false, fundsChecked: false, updatedAt: "2026-10-01T00:00:00Z" });

async function mockApi(page: Page, member = true) {
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/notices") return route.fulfill({ json: { content: notices, number: 0, size: 24, totalElements: 2, totalPages: 1 } });
    if (path.endsWith("/facets")) return route.fulfill({ json: { total: 2, endingToday: 0, open: 2, upcoming: 0 } });
    if (path.endsWith("/freshness")) return route.fulfill({ json: { generatedAt: "2026-10-11T00:00:00Z" } });
    if (path === "/api/v1/members/me") return route.fulfill(member ? { json: profile } : { status: 401 });
    if (path.endsWith("/favorites")) return route.fulfill({ json: { noticeIds: [1, 2] } });
    if (path.endsWith("/comparisons")) return route.fulfill({ json: { noticeIds: [] } });
    if (path.endsWith("/favorites/tracker")) return route.fulfill({ json: [tracker(1), tracker(2)] });
    if (path.endsWith("/saved-search-profiles")) return route.fulfill({ json: [] });
    if (path.endsWith("/search-preference") || path.endsWith("/eligibility-profile") || path.endsWith("/auth/logout") || path.endsWith("/password-reset/confirm")) return route.fulfill({ status: 204 });
    const notice = notices.find(item => path === `/api/v1/notices/${item.id}`);
    return route.fulfill(notice ? { json: notice } : { status: 404, json: { detail: "공고를 불러오지 못했습니다." } });
  });
}
async function openFavorites(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: profile.nickname, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "관심청약 2개", exact: true }).click();
  return notices.map(item => page.locator("article").filter({ hasText: item.title }));
}
async function complete(route: Route) {
  const id = Number(new URL(route.request().url()).pathname.split("/").at(-2));
  await route.fulfill({ json: { noticeId: id, ...route.request().postDataJSON(), updatedAt: "2026-10-11T00:00:00Z" } });
}

test("메모 지연: 공고별 동시 저장과 같은 공고의 순서를 보장하고 새 입력을 보존한다", async ({ page }) => {
  await mockApi(page);
  const pending: Route[] = [];
  await page.route("**/favorites/*/tracker", route => { pending.push(route); });
  const [a, b] = await openFavorites(page);
  const first = a.getByLabel("내 메모", { exact: true });
  await first.click();
  await first.fill("첫 저장"); await first.blur();
  await expect.poll(() => pending.length).toBe(1);
  await first.click();
  await first.fill("저장 중 추가 입력");
  await first.blur();
  await b.getByLabel("내 메모", { exact: true }).click();
  await b.getByLabel("내 메모", { exact: true }).fill("다른 공고 메모");
  await b.getByLabel("내 메모", { exact: true }).blur();
  await expect.poll(() => pending.length).toBe(2);
  expect(pending[1].request().url()).toContain("/favorites/2/tracker");
  await complete(pending[0]);
  await expect.poll(() => pending.length).toBe(3);
  await expect(first).toHaveValue("저장 중 추가 입력");
  expect(pending[2].request().postDataJSON()).toMatchObject({ memo: "저장 중 추가 입력", noticeDocumentChecked: true });
  await complete(pending[2]); await complete(pending[1]);
  await expect(a.getByText("저장된 메모", { exact: true })).toBeVisible();
  await expect(b.getByLabel("내 메모", { exact: true })).toHaveValue("다른 공고 메모");
});

for (const field of ["내 메모", "결과 메모"]) test(`메모 ABA: ${field}를 A→B→A로 편집해도 오래된 응답이 최신 A를 지우지 않는다`, async ({ page }) => {
  await mockApi(page);
  await page.route("**/members/me/favorites/tracker", route => route.fulfill({ json: [{ ...tracker(1), progress: "APPLIED", applicationResult: "SELECTED", applicationResultMemo: "기존 결과" }, tracker(2)] }));
  const pending: Route[] = [];
  await page.route("**/favorites/*/tracker", route => { pending.push(route); });
  const [a] = await openFavorites(page);
  const input = a.getByLabel(field, { exact: true });
  await input.click();
  await input.fill("A"); await input.blur();
  await expect.poll(() => pending.length).toBe(1);
  await input.click();
  await input.fill("B"); await input.blur();
  await input.click();
  await input.fill("A");
  await complete(pending[0]);
  await expect.poll(() => pending.length).toBe(2);
  await complete(pending[1]);
  await expect(a.getByText("저장하지 않은 메모", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("A");
  await input.blur();
  await expect.poll(() => pending.length).toBe(3);
  expect(pending[2].request().postDataJSON()[field === "내 메모" ? "memo" : "applicationResultMemo"]).toBe("A");
  await complete(pending[2]);
});

test("기존 준비 상태 조회 실패 시 편집을 막고 재조회 후 원래 체크리스트를 보존한다", async ({ page }) => {
  await mockApi(page);
  let fail = true;
  await page.route("**/members/me/favorites/tracker", route => route.fulfill(fail ? { status: 503 } : { json: [tracker(1), tracker(2)] }));
  let saved: Record<string, unknown> | undefined;
  await page.route("**/favorites/*/tracker", async route => { saved = route.request().postDataJSON(); await complete(route); });
  const [a] = await openFavorites(page);
  await expect(a.getByRole("combobox", { name: "준비 상태", exact: true })).toBeDisabled();
  await expect(a.getByLabel("내 메모", { exact: true })).toHaveCount(0);
  fail = false;
  await a.getByRole("button", { name: "메모·준비 상태 다시 불러오기" }).click();
  const input = a.getByLabel("내 메모", { exact: true });
  await expect(input).toHaveValue("기존 메모 1");
  await input.click();
  await input.fill("복구 후 수정"); await input.blur();
  await expect.poll(() => saved).toMatchObject({ memo: "복구 후 수정", noticeDocumentChecked: true });
});

test("메모 실패: 초안을 유지하고 명시적으로 재저장하며 작은 화면에서 넘치지 않는다", async ({ page }) => {
  await mockApi(page);
  const pending: Route[] = [];
  await page.route("**/favorites/*/tracker", route => { pending.push(route); });
  const [a] = await openFavorites(page);
  await page.setViewportSize({ width: 320, height: 740 });
  const input = a.getByLabel("내 메모", { exact: true });
  await input.click();
  await input.fill("실패해도 남겨둘 초안"); await input.blur();
  await expect.poll(() => pending.length).toBe(1);
  await pending[0].fulfill({ status: 503, json: { detail: "일시적인 저장 오류" } });
  await expect(a.getByRole("alert")).toContainText("입력한 메모는 유지됩니다");
  await expect(input).toHaveValue("실패해도 남겨둘 초안");
  await a.getByRole("button", { name: "메모 저장", exact: true }).click();
  await expect.poll(() => pending.length).toBe(2);
  await complete(pending[1]);
  await expect(a.getByRole("alert")).toHaveCount(0);
  await expect(a.getByText("저장된 메모", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("메모 지연: 로그아웃 뒤 이전 저장 응답이 회원 상태를 되살리지 않는다", async ({ page }) => {
  await mockApi(page);
  let pending: Route | undefined;
  await page.route("**/favorites/*/tracker", route => { pending = route; });
  const [a] = await openFavorites(page);
  await a.getByLabel("내 메모", { exact: true }).click();
  await a.getByLabel("내 메모", { exact: true }).fill("이전 회원 초안");
  await a.getByLabel("내 메모", { exact: true }).blur();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole("button", { name: profile.nickname, exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.locator(".header-actions").getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "관심청약 0개", exact: true })).toBeVisible();
  await complete(pending!);
  await expect(page.locator(".header-actions").getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
  await expect(page.getByLabel("내 메모", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "관심청약 0개", exact: true })).toBeVisible();
});

test("비교 복구: 조회 실패한 세 공고도 삭제·재시도·전체 해제할 수 있다", async ({ page }) => {
  await mockApi(page, false);
  let recovered = false;
  await page.route(/\/api\/v1\/notices\/(11|12|13)$/, route => {
    const id = Number(new URL(route.request().url()).pathname.split("/").at(-1));
    return route.fulfill(recovered && id !== 13 ? { json: { ...notices[0], id, title: `복원 공고 ${id}` } } : { status: 404, json: { detail: "조회 실패" } });
  });
  await page.goto("/?compare=11,12,13");
  const tray = page.getByRole("region", { name: "청약 공고 비교 목록" });
  await expect(tray.getByText(/불러오지 못함/)).toHaveCount(3);
  await expect(tray.getByRole("button", { name: "조회 후 비교" })).toBeDisabled();
  recovered = true;
  await tray.getByRole("button", { name: "비교 공고 다시 불러오기" }).click();
  await expect(tray.getByRole("button", { name: "비교하기", exact: true })).toBeEnabled();
  await tray.getByRole("button", { name: "공고 #13 비교 목록에서 삭제" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("compare")).toBe("11,12");
  await tray.getByRole("button", { name: "전체 해제" }).click();
  await expect(tray).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("compare")).toBe(false);
});

test("비밀번호 재설정: 성공하면 로그인 화면으로 돌아가고 늦은 회원 복원 응답을 무시한다", async ({ page }) => {
  await mockApi(page);
  let pending: Route | undefined;
  await page.route("**/members/me/favorites/tracker", route => { pending = route; });
  await page.goto("/?resetPassword=fake-reset-token");
  await expect.poll(() => Boolean(pending)).toBe(true);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("새 비밀번호", { exact: true }).fill("new-password-1234");
  await dialog.getByLabel("새 비밀번호 확인", { exact: true }).fill("new-password-1234");
  await dialog.getByRole("button", { name: "비밀번호 변경", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "로그인", exact: true })).toBeVisible();
  await pending!.fulfill({ json: [tracker(1), tracker(2)] });
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.locator(".header-actions").getByRole("button", { name: "로그인", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "관심청약 0개", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: profile.nickname, exact: true })).toHaveCount(0);
});
