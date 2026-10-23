import { expect, test, type Page, type Route } from "@playwright/test";

const disconnected = { eligible: true, configured: true, connected: false, reconnectRequired: false, message: "카카오 계정을 연결해주세요.", lastSentAt: null, lastDeliveryStatus: null };
const connected = { ...disconnected, connected: true, message: "연결 후 새로 생성된 일정 알림을 보내요." };
async function setup(page: Page, status = disconnected) {
  await page.route("**/api/v1/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/members/me") return route.fulfill({ json: { id: 42, nickname: "본인 회원", email: "owner@example.invalid", role: "MEMBER", emailVerified: true } });
    if (path === "/api/v1/members/me/kakao-self") return route.fulfill({ json: status });
    if (path.endsWith("/notifications/preference")) return route.fulfill({ json: route.request().method() === "PUT" ? route.request().postDataJSON() : {} });
    if (path.endsWith("/notifications")) return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (path.endsWith("/notifications/channels")) return route.fulfill({ json: { channels: [] } });
    if (path.endsWith("/favorites") || path.endsWith("/comparisons")) return route.fulfill({ json: { noticeIds: [] } });
    if (path.endsWith("/saved-search-profiles") || path.endsWith("/favorites/tracker")) return route.fulfill({ json: [] });
    if (path.endsWith("/search-preference") || path.endsWith("/eligibility-profile")) return route.fulfill({ status: 204 });
    if (path === "/api/v1/notices") return route.fulfill({ json: { content: [], number: 0, totalElements: 0, totalPages: 0 } });
    if (path.endsWith("/facets")) return route.fulfill({ json: { total: 0, open: 0, upcoming: 0, endingToday: 0 } });
    return route.fulfill({ status: 404 });
  });
}
async function open(page: Page, preferenceReady = true) {
  // The account button becomes ready after the entire initial account-data chain.
  // Wait for that fixture boundary before checking the UI; retain all feature assertions.
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/members/me/eligibility-profile"
      && response.request().method() === "GET" && response.status() === 204),
    page.goto("/"),
  ]);
  await expect(page.getByRole("button", { name: "본인 회원", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^알림 \d+개$/ }).click();
  const dialog = page.getByRole("dialog", { name: "맞춤 청약 알림" });
  await dialog.getByRole("tab", { name: "알림 설정", exact: true }).click();
  if (preferenceReady) await expect(dialog.getByLabel("마감 7일 전", { exact: true })).toBeEnabled();
  return dialog;
}

test("본인 전용 연결은 일반 회원에게 표시하지 않고 미설정 상태에서 연결을 막는다", async ({ page }) => {
  await setup(page, { ...disconnected, eligible: false });
  const dialog = await open(page);
  await expect(dialog.getByRole("region", { name: "카카오톡 나에게 보내기" })).toHaveCount(0);
  await page.route("**/members/me/kakao-self", route => route.fulfill({ json: { ...disconnected, configured: false } }));
  await dialog.getByRole("tab", { name: /^알림함/ }).click();
  await dialog.getByRole("tab", { name: "알림 설정", exact: true }).click();
  await expect(dialog.getByText("서버 설정 필요", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "카카오 계정 연결", exact: true })).toBeDisabled();
});

test("카카오 수신 일정은 저장 전 초안과 저장 실패를 반영하지 않고 저장 성공 후 갱신한다", async ({ page }) => {
  await setup(page, connected);
  const dialog = await open(page);
  const schedules = dialog.getByRole("group", { name: "카카오 수신 일정" });
  await expect(schedules.getByRole("listitem")).toHaveText(["접수 시작일", "마감 7일 전", "마감 3일 전", "마감 1일 전"]);
  await dialog.getByLabel("마감 7일 전", { exact: true }).uncheck();
  await expect(schedules.getByRole("listitem")).toHaveCount(4);
  await expect(schedules.getByText(/마지막으로 저장한 설정/)).toBeVisible();
  await page.route("**/notifications/preference", route => route.fulfill({ status: 503, json: { detail: "저장 실패" } }));
  await dialog.getByRole("button", { name: "알림 설정 저장", exact: true }).click();
  await expect(dialog.getByText("저장 실패", { exact: true })).toBeVisible();
  await expect(schedules.getByRole("listitem")).toHaveCount(4);
  await page.route("**/notifications/preference", route => route.fulfill({ json: route.request().postDataJSON() }));
  await dialog.getByRole("button", { name: "알림 설정 저장", exact: true }).click();
  await expect(schedules.getByRole("listitem")).toHaveText(["접수 시작일", "마감 3일 전", "마감 1일 전"]);
  await expect(schedules.getByText(/마지막으로 저장한 설정/)).toHaveCount(0);
});

test("지원 일정이 모두 꺼져 있으면 자동 발송 중단을 안내하되 시험 발송은 허용한다", async ({ page }) => {
  await setup(page, connected);
  await page.route("**/notifications/preference", route => route.fulfill({ json: {
    applyStartEnabled: false, deadline7dEnabled: false, deadline3dEnabled: false, deadline1dEnabled: false,
    winnerEnabled: true, newMatchingNoticeEnabled: true, noticeUpdatedEnabled: true, emailEnabled: true, appPushEnabled: true,
  } }));
  const dialog = await open(page);
  const schedules = dialog.getByRole("group", { name: "카카오 수신 일정" });
  await expect(schedules.getByText(/수신 일정이 모두 꺼져/)).toBeVisible();
  await expect(schedules.getByRole("listitem")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "나에게 시험 메시지 보내기", exact: true })).toBeEnabled();
  await schedules.getByRole("button", { name: "수신할 일정 설정" }).click();
  await expect(dialog.getByLabel("접수 시작일", { exact: true })).toBeFocused();
  await expect(dialog.getByLabel("접수 시작일", { exact: true })).not.toBeChecked();
});

test("설정 조회 실패 시 기본 수신 일정을 실제 저장 설정으로 표시하지 않는다", async ({ page }) => {
  await setup(page, connected);
  await page.route("**/notifications/preference", route => route.fulfill({ status: 503, json: { detail: "설정 조회 실패" } }));
  const dialog = await open(page, false);
  await expect(dialog.getByText("기존 알림 설정을 확인하지 못했습니다. 설정을 다시 불러온 뒤 저장해주세요.")).toBeVisible();
  const schedules = dialog.getByRole("group", { name: "카카오 수신 일정" });
  await expect(schedules.getByText("알림 설정을 확인한 뒤 수신 일정을 표시해요.")).toBeVisible();
  await expect(schedules.getByRole("listitem")).toHaveCount(0);
  await expect(schedules.getByRole("button", { name: "수신할 일정 설정" })).toBeDisabled();
});

test("연결 도움말은 키보드로 열리고 청약홈 로그인과 수신 범위를 설명한다", async ({ page }) => {
  await setup(page, connected);
  const dialog = await open(page);
  const section = dialog.getByRole("region", { name: "카카오톡 나에게 보내기" });
  const summary = section.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(section.getByText(/청약홈 로그인은 필요하지 않아요/)).toBeVisible();
  await expect(section.getByText(/휴대전화 수신·읽음까지/)).toBeVisible();
  await expect(section.getByText(/이메일·앱 푸시 선택과는 별개/)).toBeVisible();
  await expect(section.getByText(/공고별로 선택한 일정마다 한 건씩/)).toBeVisible();
  await expect(section.getByText(/지역·예산·평수 검색조건이나/)).toBeVisible();
  expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("미저장 알림 설정이 있으면 카카오 이동을 막고 저장 후 허용한다", async ({ page }) => {
  await setup(page); const dialog = await open(page);
  const connect = dialog.getByRole("button", { name: "카카오 계정 연결", exact: true });
  await expect(connect).toBeEnabled();
  await dialog.getByLabel("마감 7일 전", { exact: true }).uncheck();
  await expect(connect).toBeDisabled();
  await expect(dialog.getByText("변경한 알림 설정을 저장하거나 원래대로 돌린 뒤 카카오 연결을 변경해주세요.")).toBeVisible();
  await dialog.getByRole("button", { name: "알림 설정 저장", exact: true }).click();
  await expect(connect).toBeEnabled();
});

test("연결 응답의 외부 주소를 거부하고 닫은 화면의 늦은 응답으로 이동하지 않는다", async ({ page }) => {
  await setup(page);
  await page.route("**/kakao-self/authorize", route => route.fulfill({ json: { authorizationUrl: "https://example.invalid/steal" } }));
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "카카오 계정 연결", exact: true }).click();
  await expect(dialog.getByText("카카오 연결 주소를 확인하지 못했어요.")).toBeVisible();
  let pending: Route | undefined;
  await page.route("**/kakao-self/authorize", route => { pending = route; });
  await dialog.getByRole("button", { name: "카카오 계정 연결", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await pending!.fulfill({ json: { authorizationUrl: "https://kauth.kakao.com/oauth/authorize?state=fake" } });
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /^알림 \d+개$/ }).click();
  await expect(dialog).toBeVisible();
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
});

test("시험 발송은 CSRF를 사용하고 한 번만 요청하며 접수 후 대기한다", async ({ page }) => {
  await setup(page, connected);
  await page.context().addCookies([{ name: "CHEONGYAK_CSRF", value: "test-csrf", url: "http://127.0.0.1:4173" }]);
  const requests: Route[] = [];
  await page.route("**/kakao-self/test", route => { requests.push(route); });
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "나에게 시험 메시지 보내기", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].request().headers()["x-csrf-token"]).toBe("test-csrf");
  expect(requests[0].request().method()).toBe("POST");
  await expect(dialog.getByRole("button", { name: "시험 발송 후 1분 대기" })).toBeDisabled();
  await requests[0].fulfill({ json: { ...connected, lastSentAt: "2026-10-21T01:00:00Z", lastDeliveryStatus: "SENT" } });
  await expect(dialog.getByText("카카오가 시험 메시지 발송을 접수했어요. 나와의 채팅방에서 확인해주세요.")).toBeVisible();
  expect(requests).toHaveLength(1);
});

test("카카오 연결 응답 대기 중 새 알림 설정을 입력하면 이동하지 않고 초안을 보존한다", async ({ page }) => {
  await setup(page); let pending: Route | undefined;
  await page.route("**/kakao-self/authorize", route => { pending = route; });
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "카카오 계정 연결", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  const check = dialog.getByLabel("마감 7일 전", { exact: true });
  await check.uncheck();
  await pending!.fulfill({ json: { authorizationUrl: "https://kauth.kakao.com/oauth/authorize?state=fake" } });
  await expect(dialog.getByText("알림 설정이 변경되었어요. 저장을 마친 뒤 카카오 연결을 다시 눌러주세요.")).toBeVisible();
  await expect(check).not.toBeChecked();
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
});

test("시험 발송 권한이 만료되면 새 요청을 막고 다시 로그인을 안내한다", async ({ page }) => {
  await setup(page, connected); let requests = 0;
  await page.route("**/kakao-self/test", route => { requests++; return route.fulfill({ status: 401, json: { detail: "로그인이 만료됐어요." } }); });
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "나에게 시험 메시지 보내기", exact: true }).click();
  await expect(dialog.getByText("다시 로그인한 뒤 알림 설정을 열어주세요.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "카카오 연결 상태 새로고침" })).toBeDisabled();
  expect(requests).toBe(1);
});

test("시험 발송 응답 실패는 자동 재발송하지 않고 상태 조회로 복구한다", async ({ page }) => {
  await setup(page, connected); let sends = 0;
  await page.route("**/kakao-self/test", route => { sends++; return route.fulfill({ status: 503, json: { detail: "발송 결과를 확인하지 못했어요." } }); });
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "나에게 시험 메시지 보내기", exact: true }).click();
  await expect(dialog.getByText("발송 결과가 불확실할 수 있어요. 나와의 채팅방을 확인한 뒤 연결 상태를 새로고침해주세요.")).toBeVisible();
  await dialog.getByRole("button", { name: "카카오 연결 상태 새로고침" }).click();
  await expect(dialog.getByRole("button", { name: "시험 발송 후 1분 대기" })).toBeDisabled();
  expect(sends).toBe(1);
});

test("연결 해제는 DELETE로 처리하고 다시 연결 상태를 조회한다", async ({ page }) => {
  await setup(page, connected); let removed = false;
  await page.route("**/members/me/kakao-self", route => {
    if (route.request().method() === "DELETE") { removed = true; return route.fulfill({ status: 204 }); }
    return route.fulfill({ json: removed ? disconnected : connected });
  });
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "카카오 발송 연결 해제", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "카카오 계정 연결", exact: true })).toBeEnabled();
  expect(removed).toBe(true);
});

test("카카오 복귀 쿼리를 지우고 서버 연결 상태로 성공 여부를 확인한다", async ({ page }) => {
  await setup(page, disconnected);
  await page.goto("/?kakaoSelf=connected");
  const dialog = page.getByRole("dialog", { name: "맞춤 청약 알림" });
  await expect(dialog.getByRole("button", { name: "카카오 계정 연결", exact: true })).toBeEnabled();
  await expect(dialog.getByText("카카오 계정 연결을 확인했어요.")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("kakaoSelf")).toBe(false);
});

test("만료된 카카오 연결은 재연결을 안내하고 시험 발송을 숨긴다", async ({ page }) => {
  await setup(page, { ...connected, reconnectRequired: true });
  const dialog = await open(page);
  await expect(dialog.getByRole("button", { name: "카카오 다시 연결", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "나에게 시험 메시지 보내기", exact: true })).toHaveCount(0);
  const section = dialog.getByRole("region", { name: "카카오톡 나에게 보내기" });
  expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});
