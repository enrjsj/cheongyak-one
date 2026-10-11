import { expect, test, type Page, type Route } from "@playwright/test";

const profile = { id: 42, nickname: "복구 회원", email: "dialog@example.invalid", role: "MEMBER", emailVerified: true };

async function mockApi(page: Page) {
  // Every API request stays local to this test, including mail and account writes.
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/notices") return route.fulfill({ json: { content: [], number: 0, size: 24, totalElements: 0, totalPages: 0 } });
    if (path.endsWith("/facets")) return route.fulfill({ json: { total: 0, endingToday: 0, open: 0, upcoming: 0 } });
    if (path.endsWith("/freshness")) return route.fulfill({ json: { generatedAt: "2026-10-11T00:00:00Z" } });
    if (path.endsWith("/favorites") || path.endsWith("/comparisons")) return route.fulfill({ json: { noticeIds: [] } });
    if (path.endsWith("/tracker") || path.endsWith("/saved-search-profiles")) return route.fulfill({ json: [] });
    if (path.endsWith("/search-preference") || path.endsWith("/eligibility-profile")) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 401, json: { detail: "로그인이 필요합니다." } });
  });
}

async function openLogin(page: Page) {
  await page.goto("/");
  await page.locator(".header-actions").getByRole("button", { name: "로그인", exact: true }).click();
  return page.getByRole("dialog", { name: "로그인", exact: true });
}

test("인증 지연: 동일 프레임 중복 제출과 메뉴·Escape·배경 닫기를 막고 실패 후 다시 시도한다", async ({ page }) => {
  await mockApi(page);
  const pending: Route[] = [];
  await page.route("**/api/v1/auth/login", route => { pending.push(route); });
  const dialog = await openLogin(page);
  await dialog.getByLabel("이메일", { exact: true }).fill(profile.email);
  await dialog.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
  // Two submissions in one JS task exercise the synchronous guard before React renders disabled.
  await dialog.locator("form").evaluate(form => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => pending.length).toBe(1);
  await expect(dialog.getByRole("status")).toContainText("요청을 처리하고 있습니다");
  await expect(dialog.getByRole("tab", { name: "회원가입" })).toBeDisabled();
  await expect(dialog.getByRole("tab", { name: "로그인" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "닫기", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "비밀번호를 잊으셨나요?" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "인증 메일 다시 받기" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.locator(".member-backdrop").dispatchEvent("mousedown");
  await expect(dialog).toBeVisible();
  await pending[0].fulfill({ status: 401, json: { detail: "입력한 계정 정보를 확인해주세요." } });
  await expect(dialog.getByRole("alert")).toHaveText("입력한 계정 정보를 확인해주세요.");
  await expect(dialog.getByLabel("이메일", { exact: true })).toHaveValue(profile.email);
  await expect(dialog.getByRole("tab", { name: "회원가입" })).toBeEnabled();
  await dialog.getByRole("button", { name: "로그인", exact: true }).click();
  await expect.poll(() => pending.length).toBe(2);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await pending[1].fulfill({ json: profile });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: profile.nickname, exact: true })).toBeEnabled();
  expect(pending).toHaveLength(2);
});

for (const flow of [
  { entry: "비밀번호를 잊으셨나요?", title: "비밀번호 찾기", endpoint: "password-reset/request", submit: "재설정 메일 받기", back: "로그인으로 돌아가기", message: "가입 여부와 관계없이 재설정 가능한 계정에는 메일을 보냈습니다." },
  { entry: "인증 메일 다시 받기", title: "이메일 인증", endpoint: "email-verification/request", submit: "인증 메일 다시 받기", back: "인증을 완료했어요 · 로그인", message: "가입 여부와 관계없이 인증 가능한 계정에는 메일을 보냈습니다." },
]) test(`인증 지연: ${flow.title} 요청 완료 후에만 로그인으로 이동하고 이전 안내를 지운다`, async ({ page }) => {
  await mockApi(page);
  let pending: Route | undefined;
  let calls = 0;
  await page.route(`**/api/v1/auth/${flow.endpoint}`, route => { calls++; pending = route; });
  const login = await openLogin(page);
  await login.getByRole("button", { name: flow.entry, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: flow.title, exact: true });
  await dialog.getByLabel("이메일", { exact: true }).fill(profile.email);
  await dialog.getByRole("button", { name: flow.submit, exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(dialog.getByRole("button", { name: flow.back, exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "닫기", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.locator(".member-backdrop").dispatchEvent("mousedown");
  await expect(dialog).toBeVisible();
  await pending!.fulfill({ status: 204 });
  await expect(dialog.getByRole("status")).toHaveText(flow.message);
  await dialog.getByRole("button", { name: flow.back, exact: true }).click();
  await expect(login).toBeVisible();
  await expect(login.getByRole("status")).toHaveCount(0);
  await expect(login.getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(login).toHaveCount(0);
  expect(calls).toBe(1);
});

test("인증 지연: 가입 처리 중에는 전환하지 않고 성공한 뒤 이메일 인증으로 이동한다", async ({ page }) => {
  await mockApi(page);
  let pending: Route | undefined;
  let calls = 0;
  await page.route("**/api/v1/auth/signup", route => { calls++; pending = route; });
  const login = await openLogin(page);
  await login.getByRole("tab", { name: "회원가입" }).click();
  const dialog = page.getByRole("dialog", { name: "회원가입", exact: true });
  await dialog.getByLabel("닉네임", { exact: true }).fill(profile.nickname);
  await dialog.getByLabel("이메일", { exact: true }).fill(profile.email);
  await dialog.getByLabel("비밀번호", { exact: true }).fill("test-password-1234");
  await dialog.getByLabel("비밀번호 확인", { exact: true }).fill("test-password-1234");
  await dialog.getByRole("button", { name: "맞춤 정보 입력하기" }).click();
  await dialog.getByRole("checkbox", { name: "[필수] 서비스 이용약관 동의", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "[필수] 개인정보 처리방침 동의", exact: true }).check();
  await dialog.getByRole("button", { name: "선택정보 없이 가입", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(dialog.getByRole("tab", { name: "로그인" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "이전 단계" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await pending!.fulfill({ json: { ...profile, emailVerified: false } });
  const verification = page.getByRole("dialog", { name: "이메일 인증", exact: true });
  await expect(verification).toBeVisible();
  await expect(verification.getByLabel("이메일", { exact: true })).toHaveValue(profile.email);
  await expect(verification.getByRole("button", { name: "인증 메일 다시 받기", exact: true })).toBeEnabled();
  await verification.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(verification).toHaveCount(0);
  expect(calls).toBe(1);
});
