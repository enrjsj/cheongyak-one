import { expect, test, type Page, type Route } from "@playwright/test";

const row = { id: 11, noticeId: 1, noticeTitle: "초안 보호 알림", type: "APPLY_START", eventDate: "2026-10-17", createdAt: "2026-10-17T00:00:00Z", message: "일정 확인", readAt: null };
async function setup(page: Page) {
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/members/me") return route.fulfill({ json: { id: 42, nickname: "알림 회원", email: "draft@example.invalid", role: "MEMBER", emailVerified: true } });
    if (path.endsWith("/notifications/preference")) return route.fulfill({ json: route.request().method() === "PUT" ? route.request().postDataJSON() : {} });
    if (path.endsWith("/notifications")) return route.fulfill({ json: { notifications: [row], unreadCount: 1 } });
    if (path.endsWith("/favorites") || path.endsWith("/comparisons")) return route.fulfill({ json: { noticeIds: [] } });
    if (path.endsWith("/saved-search-profiles") || path.endsWith("/favorites/tracker")) return route.fulfill({ json: [] });
    if (path.endsWith("/search-preference") || path.endsWith("/eligibility-profile")) return route.fulfill({ status: 204 });
    if (path === "/api/v1/notices") return route.fulfill({ json: { content: [], number: 0, totalElements: 0, totalPages: 0 } });
    if (path.endsWith("/facets")) return route.fulfill({ json: { total: 0, open: 0, upcoming: 0, endingToday: 0 } });
    return route.fulfill({ status: 404 });
  });
}
async function open(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "알림 회원", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^알림 \d+개$/ }).click();
  const dialog = page.getByRole("dialog", { name: "맞춤 청약 알림" });
  await dialog.getByRole("tab", { name: "알림 설정", exact: true }).click();
  await expect(dialog.getByLabel("마감 7일 전", { exact: true })).toBeEnabled();
  return dialog;
}
const blocked = (page: Page) => page.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });

for (const dirty of [false, true]) test(`알림 이동 대기 중에는 새 설정을 입력할 수 없다 (기존 초안 ${dirty})`, async ({ page }) => {
  await setup(page); let pending: Route | undefined;
  await page.route("**/notifications/11/read", route => { pending = route; });
  const dialog = await open(page);
  if (dirty) {
    await dialog.getByLabel("마감 7일 전", { exact: true }).uncheck();
    page.once("dialog", item => item.accept());
  }
  await dialog.getByRole("tab", { name: /^알림함/ }).click();
  await dialog.locator(".notification-item").click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await dialog.getByRole("tab", { name: "알림 설정", exact: true }).click();
  const checks = dialog.getByRole("checkbox");
  await expect(checks).toHaveCount(9);
  for (const check of await checks.all()) await expect(check).toBeDisabled();
  await pending!.fulfill({ json: { ...row, readAt: "2026-10-17T01:00:00Z" } });
  await expect(dialog).toHaveCount(0);
});

test("알림 초안: 닫기·Escape·배경 취소와 탭 왕복이 입력을 보존하고 원복하면 경고를 해제한다", async ({ page }) => {
  await setup(page); const dialog = await open(page);
  let confirms = 0;
  page.on("dialog", async item => { confirms++; await item.dismiss(); });
  const check = dialog.getByLabel("마감 7일 전", { exact: true });
  await check.uncheck(); await expect.poll(() => blocked(page)).toBe(true);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator(".notification-backdrop").dispatchEvent("mousedown");
  expect(confirms).toBe(3); await expect(check).not.toBeChecked();
  await dialog.getByRole("tab", { name: /^알림함/ }).click();
  await expect(dialog.getByText("저장하지 않은 알림 설정이 있어요. 알림 설정 탭에서 저장해주세요.")).toBeVisible();
  await dialog.getByRole("tab", { name: "알림 설정", exact: true }).click();
  await check.check(); await expect.poll(() => blocked(page)).toBe(false);
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); expect(confirms).toBe(3);
});

test("알림 초안: 공고 이동 취소는 읽음 요청도 막고 폐기 확인 뒤 재열면 서버 설정을 읽는다", async ({ page }) => {
  await setup(page); let reads = 0;
  await page.route("**/notifications/11/read", route => { reads++; return route.fulfill({ json: { ...row, readAt: "2026-10-17T01:00:00Z" } }); });
  const dialog = await open(page);
  await dialog.getByLabel("마감 7일 전", { exact: true }).uncheck();
  await dialog.getByRole("tab", { name: /^알림함/ }).click();
  page.once("dialog", item => item.dismiss());
  await dialog.locator(".notification-item").click(); expect(reads).toBe(0);
  await expect(dialog).toBeVisible();
  page.once("dialog", item => item.accept());
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /^알림 \d+개$/ }).click();
  await dialog.getByRole("tab", { name: "알림 설정", exact: true }).click();
  await expect(dialog.getByLabel("마감 7일 전", { exact: true })).toBeChecked();
});

test("알림 초안: 저장 중 Escape 잠금·실패 보존·재시도 성공과 성공 후 재편집 안내", async ({ page }) => {
  await setup(page); const pending: Route[] = [];
  await page.route("**/notifications/preference", route => route.request().method() === "GET" ? route.fulfill({ json: {} }) : void pending.push(route));
  const dialog = await open(page); const check = dialog.getByLabel("마감 7일 전", { exact: true });
  await check.uncheck(); await dialog.getByRole("button", { name: "알림 설정 저장", exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible(); await expect(check).toBeDisabled();
  await pending[0].fulfill({ status: 503, json: { detail: "저장 실패" } });
  await expect(dialog.getByRole("alert")).toHaveText("저장 실패"); await expect(check).not.toBeChecked();
  expect(await blocked(page)).toBe(true);
  await dialog.getByRole("button", { name: "알림 설정 저장", exact: true }).click();
  await expect.poll(() => pending.length).toBe(2);
  await pending[1].fulfill({ json: pending[1].request().postDataJSON() });
  await expect(dialog.getByText("알림 설정을 저장했습니다.")).toBeVisible();
  await expect.poll(() => blocked(page)).toBe(false);
  await check.check(); await expect(dialog.getByText("알림 설정을 저장했습니다.")).toHaveCount(0);
  await expect.poll(() => blocked(page)).toBe(true);
});
