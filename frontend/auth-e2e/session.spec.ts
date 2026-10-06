import { test, expect } from "@playwright/test";

// No request interception: cookies, CSRF and persistence use the real Java API.
test("same-origin login survives reload and another tab; CSRF and logout protect saved favorites", async ({ page, context }, testInfo) => {
  const email = `auth-${testInfo.project.name}-${Date.now()}@example.test`;
  const password = "Browser-session-123!";
  const signup = await page.request.post("/api/v1/auth/signup", { data: {
    email, password, nickname: "세션검증회원", termsAgreed: true, privacyPolicyAgreed: true,
  } });
  expect(signup.status()).toBe(201);
  const origins = new Set<string>();
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) origins.add(new URL(request.url()).origin);
  });
  await page.goto("/");
  await page.locator(".header-actions").getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("dialog").getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByRole("button", { name: "세션검증회원", exact: true })).toBeVisible();
  const cookies = await context.cookies();
  const session = cookies.find(cookie => cookie.name === "CHEONGYAK_SESSION");
  expect(session).toMatchObject({ domain: "127.0.0.1", httpOnly: true, path: "/", sameSite: "Lax" });
  expect(await page.evaluate(() => document.cookie.includes("CHEONGYAK_SESSION="))).toBe(false);
  const card = page.locator("article").filter({ hasText: "로그인 유지 검증 주택" });
  await card.getByLabel(/관심청약 저장/).click();
  await expect(card.getByLabel(/관심청약 해제/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "세션검증회원", exact: true })).toBeVisible();
  await expect(card.getByLabel(/관심청약 해제/)).toBeVisible();
  const nextTab = await context.newPage();
  await nextTab.goto("/");
  await expect(nextTab.getByRole("button", { name: "세션검증회원", exact: true })).toBeVisible();
  const blocked = await nextTab.evaluate(async () => (await fetch("/api/v1/members/me/favorites/900001", { method: "DELETE" })).status);
  expect(blocked).toBe(403);
  await expect(nextTab.locator("article").filter({ hasText: "로그인 유지 검증 주택" }).getByLabel(/관심청약 해제/)).toBeVisible();
  const logout = await nextTab.evaluate(async () => {
    const token = document.cookie.split("; ").find(value => value.startsWith("CHEONGYAK_CSRF="))?.split("=")[1] ?? "";
    return (await fetch("/api/v1/auth/logout", { method: "POST", headers: { "X-CSRF-Token": token } })).status;
  });
  expect(logout).toBe(204);
  await page.reload();
  await expect(page.locator(".header-actions").getByRole("button", { name: "로그인", exact: true })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === "CHEONGYAK_SESSION")).toBe(false);
  expect((await page.request.get("/api/v1/members/me")).status()).toBe(401);
  expect([...origins]).toEqual(["http://127.0.0.1:4180"]);
});
