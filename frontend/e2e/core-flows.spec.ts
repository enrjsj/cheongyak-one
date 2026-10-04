import { expect, Page, Route, test } from "@playwright/test";

const notices = [
  { id: 1, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", title: "E2E 서울 공공분양", regionCode: "서울", address: "서울특별시 강남구", noticeDate: "2026-09-01", applyStartDate: "2026-09-10", applyEndDate: "2026-09-20", winnerAnnounceDate: "2026-09-30", totalUnits: 120, minPrice: 500000000, maxPrice: 600000000, officialUrl: "https://applyhome.example/1", syncedAt: "2026-09-01T00:00:00Z" },
  { id: 2, sourceSystem: "MYHOME_PUBLIC_RENTAL", housingCategory: "PUBLIC_RENTAL", status: "UPCOMING", title: "E2E 경기 행복주택", regionCode: "경기", address: "경기도 고양시", noticeDate: "2026-09-02", applyStartDate: "2026-09-21", applyEndDate: "2026-09-25", winnerAnnounceDate: "2026-10-03", totalUnits: 80, officialUrl: "https://applyhome.example/2", syncedAt: "2026-09-01T00:00:00Z" },
];

async function mockApi(page: Page, options: { admin?: boolean; failInitialNoticeLoad?: boolean; failNoticeLoads?: number; noticeFailureStatus?: number; failFacetLoads?: number; facetFailureStatus?: number } = {}) {
  let member: Record<string, unknown> | undefined;
  let favoriteIds: number[] = [];
  let failedNoticeRequests = 0;
  let failedFacetRequests = 0;
  let savedSearchProfiles = [{ id: 11, name: "서울 기본 조건", region: "서울", housingCategory: "APARTMENT", status: "OPEN", sort: "DEADLINE", defaultProfile: true, newNoticeEnabled: true, updatedAt: "2026-09-01T00:00:00Z" }];
  const trackers = new Map<number, Record<string, unknown>>();
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/api/v1/members/me") {
      if (request.method() === "GET") return member ? json(member) : json({ title: "Unauthorized", detail: "로그인이 필요합니다." }, 401);
      return json({ ...member, ...request.postDataJSON() });
    }
    if (path === "/api/v1/auth/signup") {
      const input = request.postDataJSON();
      member = { id: 1, email: input.email, nickname: input.nickname, role: options.admin ? "ADMIN" : "MEMBER", emailVerified: true, ...input, createdAt: "2026-09-01T00:00:00Z" };
      return json(member);
    }
    if (path === "/api/v1/auth/login") return json(member);
    if (path === "/api/v1/notices/freshness") return json({ generatedAt: "2026-09-01T00:00:00Z", lastCompletedAt: "2026-09-01T00:00:00Z" });
    if (path === "/api/v1/notices/facets" || path === "/api/v1/notices") {
      // 목록이 첫 요청 실패 후 재시도되는 사용자 흐름을 검증한다.
      // 목록과 집계의 실패 횟수를 분리해 각각의 복구 흐름을 검증한다.
      if (path === "/api/v1/notices" && url.searchParams.get("activeOnly") === "true"
        && failedNoticeRequests < (options.failNoticeLoads ?? (options.failInitialNoticeLoad ? 1 : 0))) {
        failedNoticeRequests += 1;
        if (options.noticeFailureStatus) return json({ detail: "공고 요청을 처리하지 못했습니다." }, options.noticeFailureStatus);
        return route.abort("failed");
      }
      if (path === "/api/v1/notices/facets") {
        if (failedFacetRequests < (options.failFacetLoads ?? 0)) {
          failedFacetRequests += 1;
          return json({ detail: "집계를 불러오지 못했습니다." }, options.facetFailureStatus ?? 503);
        }
        return json({ total: notices.length, endingToday: 0, open: 1, upcoming: 1 });
      }
      return json({ content: notices, number: 0, size: 24, totalElements: notices.length, totalPages: 1 });
    }
    const detail = path.match(/^\/api\/v1\/notices\/(\d+)$/);
    if (detail) return json(notices.find((notice) => notice.id === Number(detail[1])));
    if (path.endsWith("/changes")) return json([]);
    if (path.endsWith("/ai-consultations/availability")) return json({ available: false });
    if (path.endsWith("/favorites/tracker")) return json([...trackers.values()]);
    const favoriteTracker = path.match(/^\/api\/v1\/members\/me\/favorites\/(\d+)\/tracker$/);
    if (favoriteTracker) {
      const noticeId = Number(favoriteTracker[1]);
      const tracker = { noticeId, ...request.postDataJSON(), updatedAt: "2026-09-01T00:00:00Z" };
      trackers.set(noticeId, tracker);
      return json(tracker);
    }
    const favorite = path.match(/^\/api\/v1\/members\/me\/favorites\/(\d+)$/);
    if (favorite) {
      const noticeId = Number(favorite[1]);
      favoriteIds = request.method() === "PUT" ? [...new Set([...favoriteIds, noticeId])] : favoriteIds.filter((id) => id !== noticeId);
      return json({ noticeIds: favoriteIds });
    }
    if (path.endsWith("/favorites")) return json({ noticeIds: favoriteIds });
    if (path.endsWith("/comparisons")) return json({ noticeIds: [] });
    if (path === "/api/v1/members/me/saved-search-profiles") return json(savedSearchProfiles);
    const savedProfileToggle = path.match(/^\/api\/v1\/members\/me\/saved-search-profiles\/(\d+)\/new-notice-enabled$/);
    if (savedProfileToggle) {
      const id = Number(savedProfileToggle[1]);
      savedSearchProfiles = savedSearchProfiles.map((profile) => profile.id === id ? { ...profile, newNoticeEnabled: request.postDataJSON().enabled } : profile);
      return json(savedSearchProfiles.find((profile) => profile.id === id));
    }
    const savedProfile = path.match(/^\/api\/v1\/members\/me\/saved-search-profiles\/(\d+)$/);
    if (savedProfile && request.method() === "PUT") {
      const id = Number(savedProfile[1]);
      savedSearchProfiles = savedSearchProfiles.map((profile) => profile.id === id ? { ...profile, ...request.postDataJSON() } : profile);
      return json(savedSearchProfiles.find((profile) => profile.id === id));
    }
    if (path.endsWith("/search-preference")) return json(null);
    if (path.endsWith("/eligibility-profile")) {
      if (request.method() === "GET") return json(null);
      return json({ ...request.postDataJSON(), updatedAt: "2026-09-01T00:00:00Z" });
    }
    if (path.endsWith("/recommendations")) return json({ recommendations: [], dismissedCount: 0 });
    if (path.endsWith("/notifications")) return json({ notifications: [], unreadCount: 0 });
    if (path.endsWith("/notification-preference")) return json({ enabled: false });
    if (path.endsWith("/device-tokens") || path.endsWith("/sessions")) return json([]);
    return json({});
  });
}

async function signup(page: Page) {
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("tab", { name: "회원가입" }).click();
  await page.getByLabel("닉네임").fill("테스트 회원");
  await page.getByLabel("이메일").fill("e2e@example.com");
  await page.getByLabel("비밀번호", { exact: true }).fill("password-1234");
  await page.getByLabel("비밀번호 확인").fill("password-1234");
  await page.getByRole("button", { name: "맞춤 정보 입력하기" }).click();
  await page.locator('input[type="date"]').fill("1991-01-01");
  await page.locator(".profile-fields select").nth(1).selectOption("FEMALE");
  await page.getByRole("checkbox", { name: /개인정보 수집·이용/ }).check();
  await page.getByRole("checkbox", { name: /서비스 이용약관 동의/ }).check();
  await page.getByRole("checkbox", { name: /개인정보 처리방침 동의/ }).check();
  await page.getByRole("button", { name: "가입 완료하기" }).click();
  await expect(page.getByRole("button", { name: "테스트 회원" })).toBeVisible();
}

// Deliberately ignore AbortSignal for consultation POSTs: stale-response protection
// must work even if a transport cannot cancel an already-started request.
async function ignoreConsultationAbort(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => original(input,
      String(input).endsWith("/ai-consultations") && init?.method === "POST" ? { ...init, signal: undefined } : init);
  });
}

for (const scenario of ["다른 공고", "같은 공고 재열기", "대기 취소 후 재요청"]) {
  test(`상담 이전 응답은 ${scenario}의 새 답변을 덮어쓰지 않는다`, async ({ page }) => {
    await mockApi(page);
    await ignoreConsultationAbort(page);
    let pending: Route | undefined;
    let calls = 0;
    await page.route("**/api/v1/members/me/ai-consultations**", route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { available: true } });
      if (++calls === 1) { pending = route; return; }
      return route.fulfill({ json: { answer: "현재 공고의 새 답변", disclaimer: "공식 공고 확인", noticeSyncedAt: "2026-10-04T00:00:00Z" } });
    });
    await page.goto("/"); await signup(page);
    await page.locator("article").filter({ hasText: notices[0].title }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
    const panel = page.locator(".ai-consultation");
    await panel.getByRole("checkbox").check();
    await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
    await expect.poll(() => Boolean(pending)).toBe(true);
    if (scenario === "대기 취소 후 재요청") {
      await panel.getByRole("button", { name: "응답 대기 취소" }).click();
    } else {
      await page.getByRole("dialog").getByLabel("닫기", { exact: true }).click();
      await page.locator("article").filter({ hasText: notices[scenario === "다른 공고" ? 1 : 0].title }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
      await expect(panel.getByRole("checkbox")).not.toBeChecked();
      await panel.getByRole("checkbox").check();
    }
    await panel.getByRole("button", { name: /확인 항목 정리하기|답변 다시 요청/ }).click();
    await expect(panel.getByText("현재 공고의 새 답변")).toBeVisible();
    const received = page.waitForResponse(response => response.url().endsWith("/ai-consultations"));
    await pending!.fulfill(scenario === "같은 공고 재열기"
      ? { status: 401, json: { detail: "이전 요청의 세션 만료" } }
      : { json: { answer: "이전 공고의 늦은 답변", disclaimer: "old" } });
    await (await received).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(panel.getByText("현재 공고의 새 답변")).toBeVisible();
    await expect(panel.getByText("이전 공고의 늦은 답변")).toHaveCount(0);
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "확인 항목 정리하기" })).toBeEnabled();
    expect(calls).toBe(2);
  });
}

const pushDashboard = {
  registeredDeviceCount: 2, pendingCount: 0, permanentlyFailedCount: 1, sentLast24Hours: 0,
  recentFailures: [{ notificationId: 42, noticeTitle: "실패한 푸시 공고", type: "APPLY_START", attempts: 5, error: "FCM unavailable" }],
  generatedAt: "2026-10-04T00:00:00Z",
};

async function openPushAdmin(page: Page) {
  await page.route("**/api/v1/admin/sync-executions", route => route.fulfill({ json: { runningCount: 0, failuresLast24Hours: 0, executions: [] } }));
  await page.goto("/"); await signup(page);
  await page.getByRole("button", { name: "운영 관리" }).click();
  await page.getByRole("tab", { name: "푸시 발송" }).click();
}

test("관리자 푸시 재시도는 결과 갱신까지 중복 요청을 차단하고 발송 결과를 구분한다", async ({ page }) => {
  await mockApi(page, { admin: true });
  let queued = false;
  let retryCalls = 0;
  let dispatchCalls = 0;
  let pending: Route | undefined;
  await page.route("**/api/v1/admin/notifications/push**", route => {
    const url = route.request().url();
    if (url.endsWith("/retry")) { retryCalls++; queued = true; return route.fulfill({ status: 204 }); }
    if (url.endsWith("/dispatch")) { dispatchCalls++; return route.fulfill({ json: { sentCount: 1 } }); }
    if (queued && !dispatchCalls) { pending = route; return; }
    return route.fulfill({ json: dispatchCalls ? { ...pushDashboard, recentFailures: [], permanentlyFailedCount: 0, sentLast24Hours: 1 } : pushDashboard });
  });
  await openPushAdmin(page);
  const panel = page.locator(".admin-push-panel");
  await panel.getByRole("button", { name: "재시도", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(panel.getByRole("button", { name: "처리 중…" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "대기 발송" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "새로고침" })).toBeDisabled();
  expect(retryCalls).toBe(1);
  await pending!.fulfill({ json: { ...pushDashboard, recentFailures: [], permanentlyFailedCount: 0, pendingCount: 1 } });
  await expect(panel.getByText(/실제 발송 완료를 의미하지 않습니다/)).toBeVisible();
  await expect(panel.getByText("최종 실패한 푸시가 없습니다.")).toBeVisible();
  await panel.getByRole("button", { name: "대기 발송" }).click();
  await expect(panel.getByText(/대기 푸시 처리 완료: 1건/)).toBeVisible();
  expect(dispatchCalls).toBe(1);
});

test("관리자 푸시 재시도 성공 후 조회 실패는 재발송 없이 현황만 복구한다", async ({ page }) => {
  await mockApi(page, { admin: true });
  let queued = false;
  let recovered = false;
  let retryCalls = 0;
  await page.route("**/api/v1/admin/notifications/push**", route => {
    if (route.request().method() === "POST") { retryCalls++; queued = true; return route.fulfill({ status: 204 }); }
    if (queued && !recovered) return route.fulfill({ status: 503, json: { detail: "현황 조회 실패" } });
    return route.fulfill({ json: recovered ? { ...pushDashboard, recentFailures: [], permanentlyFailedCount: 0, pendingCount: 1 } : pushDashboard });
  });
  await openPushAdmin(page);
  const panel = page.locator(".admin-push-panel");
  await panel.getByRole("button", { name: "재시도", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("현황 조회 실패");
  await expect(panel.getByText(/재시도 대기열에 등록했습니다/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "재시도", exact: true })).toBeDisabled();
  recovered = true;
  await panel.getByRole("button", { name: "현황 다시 불러오기" }).click();
  await expect(panel.getByText("최종 실패한 푸시가 없습니다.")).toBeVisible();
  expect(retryCalls).toBe(1);
});

test("관리자 푸시 초기 조회와 발송 오류를 현황 재조회로 복구한다", async ({ page }) => {
  await mockApi(page, { admin: true });
  let recovered = false;
  let posts = 0;
  await page.route("**/api/v1/admin/notifications/push**", route => {
    if (route.request().method() === "POST") { posts++; return route.fulfill({ status: 503, json: { detail: "발송 결과 확인 불가" } }); }
    return recovered ? route.fulfill({ json: pushDashboard }) : route.fulfill({ status: 503, json: { detail: "초기 조회 실패" } });
  });
  await openPushAdmin(page);
  const panel = page.locator(".admin-push-panel");
  await expect(panel.getByRole("alert")).toContainText("초기 조회 실패");
  recovered = true;
  await panel.getByRole("button", { name: "현황 다시 불러오기" }).click();
  await panel.getByRole("button", { name: "대기 발송" }).click();
  await expect(panel.getByRole("alert")).toContainText("발송 결과 확인 불가");
  await expect(panel.getByRole("button", { name: "대기 발송" })).toBeDisabled();
  await panel.getByRole("button", { name: "현황 다시 불러오기" }).click();
  await expect(panel.getByRole("button", { name: "대기 발송" })).toBeEnabled();
  expect(posts).toBe(1);
});

test("닫힌 관리자 푸시 화면의 늦은 재시도 응답은 새 화면을 갱신하지 않는다", async ({ page }) => {
  await mockApi(page, { admin: true });
  let pending: Route | undefined;
  let reads = 0;
  await page.route("**/api/v1/admin/notifications/push**", route => {
    if (route.request().method() === "POST") { pending = route; return; }
    reads++;
    return route.fulfill({ json: pushDashboard });
  });
  await openPushAdmin(page);
  const panel = page.locator(".admin-push-panel");
  await panel.getByRole("button", { name: "재시도", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.getByRole("dialog").getByLabel("닫기", { exact: true }).click();
  await page.getByRole("button", { name: "운영 관리" }).click();
  await expect(panel.getByRole("button", { name: "재시도", exact: true })).toBeEnabled();
  const before = reads;
  const received = page.waitForResponse(response => response.url().endsWith("/42/retry"));
  await pending!.fulfill({ status: 204 });
  // A 204 has no body to drain; wait for its headers and React's next paint.
  await received;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(reads).toBe(before);
  await expect(panel.getByText(/재시도 대기열에 등록했습니다/)).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "재시도", exact: true })).toBeEnabled();
});

for (const status of [401, 403]) {
  test(`관리자 푸시 ${status} 응답 후 추가 발송과 조회를 차단한다`, async ({ page }) => {
    await mockApi(page, { admin: true });
    let posts = 0;
    await page.route("**/api/v1/admin/notifications/push**", route => {
      if (route.request().method() === "POST") { posts++; return route.fulfill({ status, json: { detail: "권한 없음" } }); }
      return route.fulfill({ json: pushDashboard });
    });
    await openPushAdmin(page);
    const panel = page.locator(".admin-push-panel");
    await panel.getByRole("button", { name: "재시도", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("다시 로그인해주세요");
    await expect(panel.getByRole("button", { name: "재시도", exact: true })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "대기 발송" })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "새로고침" })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "현황 다시 불러오기" })).toHaveCount(0);
    expect(posts).toBe(1);
  });
}

test("AI 상담은 로그인과 동의 후 실행하고 답변을 안전한 텍스트로 표시한다", async ({ page }) => {
  await mockApi(page);
  let consultations = 0;
  await page.route("**/api/v1/members/me/ai-consultations**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { available: true } });
    consultations++;
    expect(route.request().postDataJSON()).toEqual({ noticeId: 1, topic: "CASH", consent: true });
    return route.fulfill({ json: { noticeId: 1, topic: "CASH", answer: "<script>unsafe()</script> 계약금 조건을 확인하세요.",
      noticeSyncedAt: "2026-10-03T00:00:00Z", generatedAt: "2026-10-03T01:00:00Z", disclaimer: "공식 공고문을 확인하세요." } });
  });
  await page.goto("/?notice=1");
  await expect(page.getByText("로그인 후 이용할 수 있습니다.")).toBeVisible();
  expect(consultations).toBe(0);
  await page.getByRole("dialog").getByLabel("닫기", { exact: true }).click();
  await signup(page);
  await page.locator("article").filter({ hasText: "E2E 서울 공공분양" }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
  const panel = page.locator(".ai-consultation");
  await expect(panel.getByRole("button", { name: "확인 항목 정리하기" })).toBeDisabled();
  await panel.getByLabel("상담 주제").selectOption("CASH");
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
  await expect(panel.getByText("<script>unsafe()</script> 계약금 조건을 확인하세요.")).toBeVisible();
  await expect(panel.locator("script")).toHaveCount(0);
  expect(consultations).toBe(1);
  await page.screenshot({ path: "test-results/ai-consultation-desktop.png", fullPage: true });
});

test("AI 오류와 대기 취소가 가능하고 모바일에서 가로 넘침이 없다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  let attempts = 0;
  await page.route("**/api/v1/members/me/ai-consultations**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { available: true } });
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 429, json: { detail: "잠시 후 다시 시도해주세요." } });
    // Leave the next mock request pending until the UI cancels it.
    await new Promise<void>((resolve) => page.once("close", () => resolve()));
  });
  await page.goto("/");
  await signup(page);
  await page.locator("article").filter({ hasText: "E2E 서울 공공분양" }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
  const panel = page.locator(".ai-consultation");
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
  await expect(panel.getByRole("alert")).toHaveText("잠시 후 다시 시도해주세요.");
  await panel.getByRole("button", { name: "답변 다시 요청" }).click();
  await expect(panel.getByRole("button", { name: "답변 생성 중…" })).toBeDisabled();
  await panel.getByRole("button", { name: "응답 대기 취소" }).click();
  await expect(panel.getByRole("alert")).toContainText("응답 대기를 취소했습니다");
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/ai-consultation-mobile.png" });
});

test("상담 연결 재시도와 답변 복사에 면책·수집 기준을 포함한다", async ({ page, context }) => {
  await mockApi(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let checks = 0;
  let connectionRecovered = false;
  await page.route("**/api/v1/members/me/ai-consultations**", async route => {
    if (route.request().method() === "GET") {
      checks++;
      return !connectionRecovered ? route.fulfill({ status: 503, json: { detail: "unavailable" } }) : route.fulfill({ json: { available: true } });
    }
    return route.fulfill({ json: { answer: "공식 공고의 조건을 확인하세요.", disclaimer: "자격 판정이 아닙니다.", noticeSyncedAt: "2020-01-01T00:00:00Z" } });
  });
  await page.goto("/");
  await signup(page);
  await page.locator("article").filter({ hasText: "E2E 서울 공공분양" }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
  const panel = page.locator(".ai-consultation");
  await expect(panel.getByRole("button", { name: "연결 다시 확인" })).toBeVisible();
  const initialChecks = checks;
  connectionRecovered = true;
  await panel.getByRole("button", { name: "연결 다시 확인" }).click();
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
  await expect(panel.getByText(/공고 수집 시점이 오래/)).toBeVisible();
  await panel.getByRole("button", { name: "답변 복사" }).click();
  await expect(panel.getByRole("status")).toHaveText("답변을 복사했습니다.");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toContain("자격 판정이 아닙니다.\n공고 수집 기준:");
  expect(checks).toBe(initialChecks + 1);
});

test("상담 세션 만료 후 추가 요청을 차단한다", async ({ page }) => {
  await mockApi(page);
  let attempts = 0;
  await page.route("**/api/v1/members/me/ai-consultations**", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { available: true } });
    attempts++;
    return route.fulfill({ status: 401, json: { detail: "expired" } });
  });
  await page.goto("/");
  await signup(page);
  await page.locator("article").filter({ hasText: "E2E 서울 공공분양" }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
  const panel = page.locator(".ai-consultation");
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
  await expect(panel.getByRole("alert")).toContainText("로그인이 만료");
  await expect(panel.getByRole("button", { name: "확인 항목 정리하기" })).toBeDisabled();
  expect(attempts).toBe(1);
});

test("관리자 동기화와 AI 사용량 조회 실패를 수동 복구한다", async ({ page }) => {
  await mockApi(page, { admin: true });
  let syncs = 0;
  let usages = 0;
  let usageRecovered = false;
  await page.route("**/api/v1/admin/**", route => {
    if (route.request().url().endsWith("/ai-consultations/usage")) {
      usages++;
      return !usageRecovered ? route.fulfill({ status: 503, json: { detail: "사용량 조회 실패" } }) :
        route.fulfill({ json: [{ date: "2026-10-04", requests: 4, succeeded: 2, failed: 1, active: 1 }] });
    }
    if (route.request().method() === "POST") { syncs++; return route.fulfill({ status: 202 }); }
    return route.fulfill({ json: { runningCount: 0, failuresLast24Hours: 0, executions: [] } });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "운영 관리" }).click();
  page.on("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "지금 동기화", exact: true }).click();
  await expect(page.getByText(/공고 동기화를 시작했습니다/)).toBeVisible();
  expect(syncs).toBe(1);
  await page.getByRole("tab", { name: "AI 사용량" }).click();
  await expect(page.getByRole("button", { name: "다시 시도", exact: true })).toBeVisible();
  usageRecovered = true;
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(page.getByText("완료 요청 실패율: 33.3%")).toBeVisible();
});

test("알림 설정 저장 결과와 채널 준비 상태를 구분한다", async ({ page }) => {
  await mockApi(page);
  let saved: Record<string, unknown> | undefined;
  await page.route("**/api/v1/members/me/notifications/preference", route => {
    if (route.request().method() === "PUT") saved = route.request().postDataJSON();
    return route.fulfill({ json: saved ?? {} });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "알림 0개", exact: true }).click();
  await page.getByRole("tab", { name: "알림 설정" }).click();
  await page.getByRole("checkbox", { name: "마감 7일 전", exact: true }).uncheck();
  await page.getByRole("button", { name: "알림 설정 저장" }).click();
  await expect(page.getByText("알림 설정을 저장했습니다.")).toBeVisible();
  expect(saved?.deadline7dEnabled).toBe(false);
  await expect(page.getByLabel("외부 알림 채널 상태").getByText("준비 중", { exact: true })).toHaveCount(4);
});

test("알림 설정 조회 실패 시 저장을 막고 기존 설정을 수동 복구한다", async ({ page }) => {
  await mockApi(page);
  let recovered = false;
  let saves = 0;
  await page.route("**/api/v1/members/me/notifications/preference", route => {
    if (route.request().method() === "PUT") {
      saves++;
      return route.fulfill({ json: route.request().postDataJSON() });
    }
    return recovered ? route.fulfill({ json: { deadline7dEnabled: false } }) :
      route.fulfill({ status: 503, json: { detail: "설정 조회 실패" } });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "알림 0개", exact: true }).click();
  await page.getByRole("tab", { name: "알림 설정" }).click();
  await expect(page.getByRole("button", { name: "알림 설정 저장" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "마감 7일 전", exact: true })).toBeDisabled();
  expect(saves).toBe(0);
  recovered = true;
  await page.getByRole("button", { name: "설정 다시 불러오기" }).click();
  await expect(page.getByRole("checkbox", { name: "마감 7일 전", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "알림 설정 저장" }).click();
  await expect(page.getByText("알림 설정을 저장했습니다.")).toBeVisible();
  expect(saves).toBe(1);
});

test("알림 저장 실패는 편집값을 유지하고 수동 재시도한다", async ({ page }) => {
  await mockApi(page);
  let saves = 0;
  await page.route("**/api/v1/members/me/notifications/preference", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: {} });
    saves++;
    return saves === 1 ? route.fulfill({ status: 503, json: { detail: "저장 실패" } }) :
      route.fulfill({ json: route.request().postDataJSON() });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "알림 0개", exact: true }).click();
  await page.getByRole("tab", { name: "알림 설정" }).click();
  await page.getByRole("checkbox", { name: "마감 7일 전", exact: true }).uncheck();
  await page.getByRole("button", { name: "알림 설정 저장" }).click();
  await expect(page.getByRole("alert")).toHaveText("저장 실패");
  await expect(page.getByRole("checkbox", { name: "마감 7일 전", exact: true })).not.toBeChecked();
  expect(saves).toBe(1);
  await page.getByRole("button", { name: "알림 설정 저장" }).click();
  await expect(page.getByText("알림 설정을 저장했습니다.")).toBeVisible();
  expect(saves).toBe(2);
});

test("알림 저장 중 세션이 만료되면 추가 저장을 차단한다", async ({ page }) => {
  await mockApi(page);
  let saves = 0;
  await page.route("**/api/v1/members/me/notifications/preference", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: {} });
    saves++;
    return route.fulfill({ status: 401, json: { detail: "session expired" } });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "알림 0개", exact: true }).click();
  await page.getByRole("tab", { name: "알림 설정" }).click();
  await page.getByRole("button", { name: "알림 설정 저장" }).click();
  await expect(page.getByText("로그인이 만료되었습니다. 다시 로그인한 뒤 알림 창을 열어주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "알림 설정 저장" })).toBeDisabled();
  expect(saves).toBe(1);
});

test("닫힌 알림창의 늦은 새로고침이 새 창의 읽지 않은 개수를 덮어쓰지 않는다", async ({ page }) => {
  await mockApi(page);
  let delayNext = false;
  let release!: () => void;
  let held = false;
  await page.route("**/api/v1/members/me/notifications", async route => {
    if (delayNext) {
      delayNext = false; held = true;
      await new Promise<void>(resolve => { release = resolve; });
      return route.fulfill({ json: { notifications: [], unreadCount: 99 } });
    }
    return route.fulfill({ json: { notifications: [], unreadCount: 3 } });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "알림 3개", exact: true }).click();
  await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeVisible();
  delayNext = true;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect.poll(() => held).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "알림 3개", exact: true }).click();
  await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeVisible();
  const completed = page.waitForResponse(async response => response.url().endsWith("/notifications") && (await response.json()).unreadCount === 99);
  release();
  await completed;
  await page.getByRole("tab", { name: "알림 설정", exact: true }).click();
  await expect(page.getByRole("button", { name: "알림 3개", exact: true })).toBeVisible();
});

test("이전 알림창의 저장 실패가 다시 연 창에 만료 오류를 표시하지 않는다", async ({ page }) => {
  await mockApi(page);
  let release!: () => void;
  let held = false;
  await page.route("**/api/v1/members/me/notifications/preference", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { deadline7dEnabled: false } });
    held = true;
    await new Promise<void>(resolve => { release = resolve; });
    return route.fulfill({ status: 401, json: { detail: "old session expired" } });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "알림 0개", exact: true }).click();
  await page.getByRole("tab", { name: "알림 설정" }).click();
  await page.getByRole("button", { name: "알림 설정 저장" }).click();
  await expect.poll(() => held).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "알림 0개", exact: true }).click();
  await expect(page.getByRole("button", { name: "알림 설정 저장" })).toBeEnabled();
  const completed = page.waitForResponse(response => response.url().endsWith("/preference") && response.status() === 401);
  release();
  await completed;
  await page.getByRole("checkbox", { name: "마감 7일 전", exact: true }).check();
  await expect(page.getByRole("button", { name: "알림 설정 저장" })).toBeEnabled();
  await expect(page.getByText(/다시 로그인한 뒤 알림 창/)).toHaveCount(0);
});

test("닫힌 알림창의 읽음 응답이 뒤늦게 공고 상세를 열지 않는다", async ({ page }) => {
  await mockApi(page);
  const notification = { id: 11, noticeId: 1, noticeTitle: "테스트 일정 알림", type: "APPLY_START",
    eventDate: "2026-10-04", createdAt: "2026-10-04T00:00:00Z", message: "접수를 확인하세요.", readAt: null };
  let release!: () => void;
  let held = false;
  await page.route("**/api/v1/members/me/notifications", route =>
    route.fulfill({ json: { notifications: [notification], unreadCount: 1 } }));
  await page.route("**/api/v1/members/me/notifications/11/read", async route => {
    held = true;
    await new Promise<void>(resolve => { release = resolve; });
    return route.fulfill({ json: { ...notification, readAt: "2026-10-04T01:00:00Z" } });
  });
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: "알림 1개", exact: true }).click();
  await page.locator(".notification-item").click();
  await expect.poll(() => held).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "알림 1개", exact: true }).click();
  await expect(page.locator(".notification-item")).toBeEnabled();
  const completed = page.waitForResponse(response => response.url().endsWith("/11/read"));
  release();
  await completed;
  await page.getByRole("tab", { name: "알림 설정" }).click();
  await expect(page.getByRole("dialog", { name: "맞춤 청약 알림" })).toBeVisible();
});

test("AI 미연결 상태는 신청 버튼 없이 준비 안내를 표시한다", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await signup(page);
  await page.locator("article").filter({ hasText: "E2E 서울 공공분양" }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
  await expect(page.getByText("OpenAI 연결 준비 중입니다. 연결 후 상담을 이용할 수 있습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "확인 항목 정리하기" })).toHaveCount(0);
});

test("비회원도 관심청약 저장과 공고 비교를 할 수 있다", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await expect(page.getByText(/최근 동기화/)).toBeVisible();
  await page.locator("article").filter({ hasText: "E2E 서울 공공분양" }).getByLabel(/관심청약 저장/).click();
  await page.locator(".saved-button").click();
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await page.locator(".saved-button").click();
  await page.getByRole("button", { name: "비교 담기" }).nth(0).click();
  await page.getByRole("button", { name: "비교 담기" }).nth(0).click();
  await page.getByRole("button", { name: "비교하기" }).click();
  await expect(page.getByRole("heading", { name: "청약 공고 비교" })).toBeVisible();
});

test("Render 기동 중 첫 공고 요청이 실패하면 자동으로 다시 불러온다", async ({ page }) => {
  await mockApi(page, { failInitialNoticeLoad: true });
  await page.goto("/");

  await expect(page.getByText(/서버를 깨우는 중이에요/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible({ timeout: 7_000 });
});

test("503 응답이 세 번 이어져도 대기 안내를 유지하고 공고를 복구한다", async ({ page }) => {
  await page.clock.install();
  await mockApi(page, { failNoticeLoads: 3, noticeFailureStatus: 503 });
  await page.goto("/");
  await expect(page.getByText(/4초 후 자동으로 다시 시도/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.clock.fastForward(4_000);
  await expect(page.getByText(/7초 후 자동으로 다시 시도/)).toBeVisible();
  await page.clock.fastForward(8_000);
  await expect(page.getByText(/14초 후 자동으로 다시 시도/)).toBeVisible();
  await page.clock.fastForward(15_000);
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await expect(page.getByText(/서버를 깨우는 중이에요/)).toHaveCount(0);
});

test("자동 대기 시간이 지나면 중단하고 수동 재시도로 새 대기를 시작한다", async ({ page }) => {
  await page.clock.install();
  await mockApi(page, { failNoticeLoads: Infinity, noticeFailureStatus: 503 });
  await page.goto("/");
  await expect(page.getByText(/서버를 깨우는 중이에요/)).toBeVisible();
  await page.clock.fastForward(5 * 60_000 + 1_000);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText(/서버를 깨우는 중이에요/)).toHaveCount(0);
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByText(/서버를 깨우는 중이에요/)).toBeVisible();
});

test("요청 오류는 자동 재시도하지 않고 검색 조건 변경은 이전 대기를 취소한다", async ({ page }) => {
  const options = { failNoticeLoads: Infinity, noticeFailureStatus: 400 };
  let requests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/notices" && url.searchParams.get("activeOnly") === "true") requests += 1;
  });
  await page.clock.install();
  await mockApi(page, options);
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.clock.fastForward(30_000);
  expect(requests).toBe(1);
  options.noticeFailureStatus = 503;
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByText(/서버를 깨우는 중이에요/)).toBeVisible();
  await page.getByRole("tab", { name: /접수중/ }).click();
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await expect(page.getByText(/서버를 깨우는 중이에요/)).toHaveCount(0);
  const completedRequests = requests;
  await page.clock.fastForward(30_000);
  expect(requests).toBe(completedRequests);
});

test("서버 응답을 기다리는 동안 최근에 불러온 목록을 유지한다", async ({ page }) => {
  const options = { failNoticeLoads: 0, noticeFailureStatus: 503 };
  await mockApi(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  options.failNoticeLoads = Infinity;
  await page.reload();
  await expect(page.getByText(/서버를 깨우는 중이에요/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("집계가 연속 실패해도 목록을 표시하고 상태별 건수를 자동 복구한다", async ({ page }) => {
  const options = { failFacetLoads: Infinity };
  await page.clock.install();
  await mockApi(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  const openCount = page.getByRole("tab", { name: /접수중/ }).locator("b");
  await expect(openCount).toHaveText("–");
  await expect(page.locator(".week-stats strong")).toHaveText(["–", "–", "–"]);
  await page.clock.fastForward(4_000);
  await expect(openCount).toHaveText("–");
  await page.clock.fastForward(8_000);
  await expect(openCount).toHaveText("–");
  options.failFacetLoads = 0;
  await page.clock.fastForward(15_000);
  await expect(openCount).toHaveText("1");
  await expect(page.locator(".week-stats strong")).toHaveText(["1", "0", "1"]);
  await expect(page.locator(".facets-error")).toHaveCount(0);
});

test("집계 요청 오류는 0건으로 표시하거나 자동 반복하지 않고 수동으로 복구한다", async ({ page }) => {
  const options = { failFacetLoads: Infinity, facetFailureStatus: 400 };
  let facetRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/notices/facets") facetRequests += 1;
  });
  await page.clock.install();
  await mockApi(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await expect(page.getByRole("button", { name: "건수 다시 불러오기" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("–");
  const failedRequests = facetRequests;
  await page.clock.fastForward(30_000);
  expect(facetRequests).toBe(failedRequests);
  options.failFacetLoads = 0;
  await page.getByRole("button", { name: "건수 다시 불러오기" }).click();
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("1");
  await expect(page.locator(".facets-error")).toHaveCount(0);
});

test("집계 자동 대기가 끝나면 멈추고 수동 요청으로 새 대기를 시작한다", async ({ page }) => {
  const options = { failFacetLoads: Infinity };
  let facetRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/notices/facets") facetRequests += 1;
  });
  await page.clock.install();
  await mockApi(page, options);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await page.clock.fastForward(5 * 60_000 + 1_000);
  await expect(page.getByRole("button", { name: "건수 다시 불러오기" })).toBeVisible();
  const stoppedRequests = facetRequests;
  await page.clock.fastForward(30_000);
  expect(facetRequests).toBe(stoppedRequests);
  await page.getByRole("button", { name: "건수 다시 불러오기" }).click();
  await expect.poll(() => facetRequests).toBe(stoppedRequests + 1);
  options.failFacetLoads = 0;
  await page.clock.fastForward(4_000);
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("1");
});

test("검색 조건을 바꾸면 이전 집계 재시도를 취소하고 새 조건의 건수만 표시한다", async ({ page }) => {
  await page.clock.install();
  await mockApi(page);
  let unfilteredRequests = 0;
  await page.route("**/api/v1/notices/facets**", (route) => {
    const keyword = new URL(route.request().url()).searchParams.get("keyword");
    if (!keyword) unfilteredRequests += 1;
    return route.fulfill({ status: keyword ? 200 : 503, contentType: "application/json",
      body: JSON.stringify(keyword ? { total: 7, open: 5, upcoming: 2, endingToday: 0 } : {}) });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("–");
  await page.getByRole("textbox", { name: "청약 검색어" }).fill("서울");
  await page.getByRole("button", { name: /청약 찾기/ }).click();
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("5");
  const previousRequests = unfilteredRequests;
  await page.clock.fastForward(30_000);
  expect(unfilteredRequests).toBe(previousRequests);
  await expect(page.locator(".week-stats strong")).toHaveText(["5", "0", "2"]);
});

test("새 검색의 집계가 실패하면 이전 조건의 건수를 남기지 않는다", async ({ page }) => {
  const options = { failFacetLoads: 0, facetFailureStatus: 400 };
  await mockApi(page, options);
  await page.goto("/");
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("1");
  options.failFacetLoads = Infinity;
  await page.getByRole("textbox", { name: "청약 검색어" }).fill("부산");
  await page.getByRole("button", { name: /청약 찾기/ }).click();
  await expect(page.getByRole("button", { name: "건수 다시 불러오기" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("–");
  await expect(page.locator(".week-stats strong")).toHaveText(["–", "–", "–"]);
});

test("기본 목록은 모집 중·예정 공고를 우선하고 최근 검색과 상세 정렬을 제공한다", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await expect(page.getByRole("tab", { name: /모집 중·예정/ })).toBeVisible();
  await page.getByRole("combobox", { name: "청약 공고 정렬" }).selectOption("PRICE_ASC");
  await page.getByRole("textbox", { name: "청약 검색어" }).fill("서울");
  await page.getByRole("button", { name: /청약 찾기/ }).click();
  await expect(page.getByLabel("최근 검색").getByRole("button", { name: "서울", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "마감 공고 포함" }).click();
  await expect(page.getByText(/마감 공고를 포함한 공고/)).toBeVisible();
});

test("상태 탭은 미리 받은 목록으로 로딩 없이 전환한다", async ({ page }) => {
  await mockApi(page);
  let facetRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/notices/facets") facetRequests += 1;
  });
  const openPrefetched = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/notices" && url.searchParams.get("status") === "OPEN";
  });

  await page.goto("/");
  await openPrefetched;
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /접수중/ }).locator("b")).toHaveText("1");
  const initialFacetRequests = facetRequests;
  await page.getByRole("tab", { name: /접수중/ }).click();
  await expect(page.getByRole("status", { name: "청약 공고 불러오는 중" })).toHaveCount(0);
  await expect(page.getByText("조건에 맞는 공고 2건")).toBeVisible();
  await page.waitForTimeout(400);
  expect(facetRequests).toBe(initialFacetRequests);
});

test("회원가입 후 사전점검 답변을 계정에 저장한다", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: /확인사항 정리하기/ }).click();
  for (const answer of ["네, 무주택이에요", "네, 보유하고 있어요", "네, 확인하고 있어요", "네, 확인하고 있어요"]) {
    await page.getByRole("button", { name: answer }).click();
  }
  await expect(page.getByText("나의 확인 체크리스트")).toBeVisible();
  await page.getByRole("button", { name: "내 계정에 저장" }).click();
  await expect(page.getByText("사전점검 답변을 저장했습니다.")).toBeVisible();
});

test("저장 조건을 수정하고 신규 공고 알림을 개별로 끈다", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: /청약 필터 열기/ }).click();
  await expect(page.getByText("서울 기본 조건")).toBeVisible();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await expect(page.getByRole("heading", { name: "저장 조건 수정" })).toBeVisible();
  await page.getByLabel("조건 이름").fill("서울 아파트 조건");
  await page.getByLabel("지역").selectOption("경기");
  await page.getByLabel("최소 예산 (만원)").fill("30000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("저장 조건을 수정했습니다.")).toBeVisible();
  await expect(page.getByText(/경기 · 아파트 · 전체 공급 · 30,000만원 이상/)).toBeVisible();
  await page.getByRole("button", { name: "신규 알림 켜짐", exact: true }).click();
  await expect(page.getByRole("button", { name: "신규 알림 꺼짐", exact: true })).toBeVisible();
});

