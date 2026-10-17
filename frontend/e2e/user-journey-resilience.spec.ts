import { expect, test, type Page } from "@playwright/test";

const member = { id: 42, nickname: "검증 회원", email: "journey@example.invalid", role: "MEMBER", emailVerified: true };
const notices = [1, 2].map(id => ({ id, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", title: `검증 공고 ${id}`, regionCode: "서울", address: "서울특별시", noticeDate: "2026-10-01", applyStartDate: "2026-10-01", applyEndDate: "2026-10-30", totalUnits: 10, officialUrl: "https://example.invalid/notice", syncedAt: "2026-10-01T00:00:00Z" }));
const recentKey = "cheongyak-one-recent-notices";
async function mockApi(page: Page, invalidDates = false) {
  const data = notices.map(item => invalidDates ? { ...item, applyStartDate: "2026-10-30", applyEndDate: "2026-10-01" } : item);
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/notices") return route.fulfill({ json: { content: data, number: 0, size: 24, totalElements: 2, totalPages: 1 } });
    if (path.endsWith("/facets")) return route.fulfill({ json: { total: 2, endingToday: 0, open: 2, upcoming: 0 } });
    if (path.endsWith("/freshness")) return route.fulfill({ json: { generatedAt: "2026-10-17T00:00:00Z" } });
    if (path === "/api/v1/members/me") return route.fulfill({ json: member });
    if (path.endsWith("/favorites")) return route.fulfill({ json: { noticeIds: [1, 2] } });
    if (path.endsWith("/comparisons")) return route.fulfill({ json: { noticeIds: [] } });
    if (path.endsWith("/favorites/tracker")) return route.fulfill({ json: data.map(item => ({ noticeId: item.id, progress: "SAVED", memo: "=1+1", applicationResult: "PENDING", applicationResultMemo: "", noticeDocumentChecked: false, eligibilityChecked: false, scheduleChecked: false, fundsChecked: false })) });
    if (path.endsWith("/saved-search-profiles")) return route.fulfill({ json: [] });
    if (path.endsWith("/search-preference") || path.endsWith("/eligibility-profile")) return route.fulfill({ status: 204 });
    const notice = data.find(item => path === `/api/v1/notices/${item.id}`);
    return route.fulfill(notice ? { json: notice } : { status: 404 });
  });
}
async function favorites(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: member.nickname, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "관심청약 2개", exact: true }).click();
}

test("관심 검색·필터가 0건이어도 입력과 포커스를 유지하고 바로 수정한다", async ({ page }) => {
  await mockApi(page); await favorites(page);
  await page.setViewportSize({ width: 320, height: 740 });
  const input = page.getByPlaceholder("공고명, 지역, 내 메모");
  await input.click(); await input.fill("없는검색어");
  await expect(input).toBeFocused(); await expect(input).toHaveValue("없는검색어");
  await expect(page.locator(".result-summary")).toContainText("공고 0건");
  await input.fill("검증 공고 1");
  await expect(page.locator(".application-list article")).toHaveCount(1);
  await input.fill("");
  const filters = page.getByRole("group", { name: "관심청약 준비 상태 필터" });
  await filters.getByRole("button", { name: "신청 준비 완료 0", exact: true }).click();
  await expect(input).toBeVisible();
  await filters.getByRole("button", { name: "전체 2", exact: true }).click();
  await expect(page.locator(".application-list article")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("관심 첫 페이지 검색이 0건이어도 다음 페이지에서 일치 공고를 찾는다", async ({ page }) => {
  await mockApi(page);
  const many = Array.from({ length: 50 }, (_, index) => ({ ...notices[0], id: index + 1, title: index === 12 ? "다음페이지 대상" : `페이지 공고 ${index + 1}` }));
  await page.route("**/api/v1/members/me/favorites", route => route.fulfill({ json: { noticeIds: many.map(item => item.id) } }));
  await page.route(/\/api\/v1\/notices\?/, route => {
    const number = Number(new URL(route.request().url()).searchParams.get("page") ?? 0);
    const size = Number(new URL(route.request().url()).searchParams.get("size"));
    return route.fulfill({ json: { content: many.slice(number * size, (number + 1) * size), number, size, totalElements: 50, totalPages: Math.ceil(50 / size) } });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: member.nickname, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "관심청약 50개", exact: true }).click();
  await expect(page.locator(".result-summary")).toContainText("공고 50건");
  await page.getByPlaceholder("공고명, 지역, 내 메모").fill("다음페이지 대상");
  await expect(page.locator(".result-summary")).toHaveText("불러온 12건 중 조건에 맞는 공고 0건");
  await page.getByRole("button", { name: "다음 12건 더보기" }).click();
  await expect(page.getByRole("article", { name: "다음페이지 대상", exact: true })).toBeVisible();
  await expect(page.locator(".result-summary")).toHaveText("불러온 24건 중 조건에 맞는 공고 1건");
});

test("최근 기록 실패도 표시하고 삭제를 유지하며 재조회·전체 삭제를 지원한다", async ({ page }) => {
  await mockApi(page); await page.goto("/");
  await page.evaluate(key => localStorage.setItem(key, "[11,12]"), recentKey); await page.reload();
  const recent = page.getByRole("region", { name: "최근 본 공고" });
  await expect(recent.getByText("공고 #11 · 불러오지 못했어요")).toBeVisible();
  await recent.getByRole("button", { name: "공고 #11 최근 본 공고에서 삭제" }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), recentKey)).toBe("[12]");
  await page.reload();
  await expect(recent.getByText("공고 #12 · 불러오지 못했어요")).toBeVisible();
  await expect(recent.getByText(/공고 #11/)).toHaveCount(0);
  await page.route("**/api/v1/notices/12", route => route.fulfill({ json: { ...notices[0], id: 12, title: "복구된 공고" } }));
  await recent.getByRole("button", { name: "최근 공고 다시 불러오기" }).click();
  await expect(recent.getByText("복구된 공고", { exact: true })).toBeVisible();
  await recent.getByRole("button", { name: "복구된 공고 최근 본 공고에서 삭제" }).click();
  await page.reload(); await expect(recent).toHaveCount(0);
  await page.evaluate(key => localStorage.setItem(key, "[1,2]"), recentKey); await page.reload();
  await recent.getByRole("button", { name: "전체 삭제" }).click();
  await page.reload(); await expect(recent).toHaveCount(0);
});

for (const kind of ["CSV", "캘린더"]) test(`${kind} 생성 실패를 안내하고 같은 화면에서 재시도한다`, async ({ page }) => {
  await mockApi(page); await favorites(page);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL); let fail = true;
    URL.createObjectURL = blob => { if (fail) { fail = false; throw new Error("test download failure"); } return original(blob); };
  });
  const button = page.getByRole("button", { name: kind === "CSV" ? "내 기록 CSV" : "관심 일정 저장", exact: true });
  await button.click();
  await expect(page.getByText(`${kind} 파일을 만들지 못했어요. 다시 시도해 주세요.`, { exact: true })).toBeVisible();
  const download = page.waitForEvent("download"); await button.click();
  expect((await download).suggestedFilename()).toMatch(kind === "CSV" ? /\.csv$/ : /\.ics$/);
  expect(errors).toEqual([]);
});

test("관심 CSV는 수식형 메모를 문자열로 내보낸다", async ({ page }) => {
  await mockApi(page); await favorites(page);
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { if (blob instanceof Blob) void blob.text().then(text => { document.body.dataset.exportText = text; }); return original(blob); };
  });
  await page.getByRole("button", { name: "내 기록 CSV", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.exportText)).toContain('"\'=1+1"');
});

test("저장소 차단 시 최근 기록 삭제의 현재 화면 한계를 안내한다", async ({ page }) => {
  await mockApi(page); await page.goto("/");
  await page.evaluate(key => localStorage.setItem(key, "[1,2]"), recentKey); await page.reload();
  const recent = page.getByRole("region", { name: "최근 본 공고" });
  await expect(recent.getByText("검증 공고 1", { exact: true })).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("blocked storage"); }; });
  await recent.getByRole("button", { name: "검증 공고 1 최근 본 공고에서 삭제" }).click();
  await expect(recent.getByText("검증 공고 1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("현재 화면에서만 삭제했어요. 브라우저 저장소를 사용할 수 없습니다.", { exact: true })).toBeVisible();
});

test("최근 공고는 오프라인에 재시도를 막고 재연결하면 복구한다", async ({ page }) => {
  await mockApi(page); await page.goto("/");
  await page.evaluate(key => localStorage.setItem(key, "[12]"), recentKey); await page.reload();
  const recent = page.getByRole("region", { name: "최근 본 공고" });
  await expect(recent.getByText("공고 #12 · 불러오지 못했어요")).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); window.dispatchEvent(new Event("offline")); });
  await expect(recent.getByRole("button", { name: "최근 공고 다시 불러오기" })).toBeDisabled();
  await page.route("**/api/v1/notices/12", route => route.fulfill({ json: { ...notices[0], id: 12, title: "연결 복구" } }));
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); window.dispatchEvent(new Event("online")); });
  await expect(recent.getByText("연결 복구", { exact: true })).toBeVisible();
});

test("유효한 일정이 없는 관심 공고는 빈 캘린더를 다운로드하지 않는다", async ({ page }) => {
  await mockApi(page, true); await favorites(page);
  const downloads: string[] = []; page.on("download", item => downloads.push(item.suggestedFilename()));
  await page.getByRole("button", { name: "관심 일정 저장", exact: true }).click();
  await expect(page.getByText("저장할 청약 일정이 아직 없어요.", { exact: true })).toBeVisible();
  expect(downloads).toEqual([]);
});
