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
    if (path.endsWith("/recommendations")) return json({ configured: false, recommendations: [], dismissedCount: 0 });
    if (path.endsWith("/notifications")) return json({ notifications: [], unreadCount: 0 });
    if (path.endsWith("/notification-preference")) return json({ enabled: false });
    if (path.endsWith("/device-tokens") || path.endsWith("/sessions")) return json([]);
    return json({});
  });
}

async function signup(page: Page) {
  await page.locator(".header-actions").getByRole("button", { name: "로그인", exact: true }).click();
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

for (const change of ["주제 변경", "새 상담", "재열기"]) {
  test(`상담 복사 대기 중 ${change} 후 이전 복사 결과를 표시하지 않는다`, async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => {
      const pending: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
      (window as any).__copies = pending;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: () => new Promise<void>((resolve, reject) => pending.push({ resolve, reject })),
      } });
    });
    let calls = 0;
    await page.route("**/api/v1/members/me/ai-consultations**", route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { available: true } });
      return route.fulfill({ json: { answer: `답변 ${++calls}`, disclaimer: "공식 공고 확인", noticeSyncedAt: "2026-10-04T00:00:00Z" } });
    });
    await page.goto("/"); await signup(page);
    const openNotice = () => page.locator("article").filter({ hasText: notices[0].title }).getByRole("button", { name: /공고 핵심만 보기/ }).click();
    await openNotice();
    const panel = page.locator(".ai-consultation");
    await panel.getByRole("checkbox").check();
    await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
    await panel.getByRole("button", { name: "답변 복사" }).click();
    if (change === "주제 변경") await panel.getByLabel("상담 주제").selectOption("CASH");
    if (change === "재열기") {
      await page.getByRole("dialog").getByLabel("닫기", { exact: true }).click();
      await openNotice();
      await panel.getByRole("checkbox").check();
    }
    await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
    await expect(panel.getByText("답변 2", { exact: true })).toBeVisible();
    await page.evaluate((reject) => { const copy = (window as any).__copies[0]; reject ? copy.reject(new Error("old copy")) : copy.resolve(); }, change === "새 상담");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(panel.getByRole("status")).toHaveCount(0);
    await panel.getByRole("button", { name: "답변 복사" }).click();
    await page.evaluate(() => (window as any).__copies[1].resolve());
    await expect(panel.getByRole("status")).toHaveText("답변을 복사했습니다.");
  });
}

async function openPushAdmin(page: Page) {
  await page.route("**/api/v1/admin/sync-executions", route => route.fulfill({ json: { runningCount: 0, failuresLast24Hours: 0, executions: [] } }));
  await page.goto("/"); await signup(page);
  await page.getByRole("button", { name: "운영 관리" }).click();
  await page.getByRole("tab", { name: "푸시 발송" }).click();
}

test("관리자 푸시 묶음 처리의 진행 상태와 부분 오류를 표시하고 다음 결과로 교체한다", async ({ page }) => {
  await mockApi(page, { admin: true });
  let pending: Route | undefined;
  let calls = 0;
  await page.route("**/api/v1/admin/notifications/push**", route => {
    if (route.request().url().endsWith("/dispatch")) { calls++; pending = route; return; }
    return route.fulfill({ json: pushDashboard });
  });
  await openPushAdmin(page);
  const panel = page.locator(".admin-push-panel");
  await panel.getByRole("button", { name: "대기 발송" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(panel.getByText(/대기 푸시를 처리하고 있습니다/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "대기 발송" })).toBeDisabled();
  expect(calls).toBe(1);
  await pending!.fulfill({ json: { sentCount: 1, acceptedCount: 1, selectedCount: 4, otherCount: 2, errorCount: 1 } });
  await expect(panel.getByText(/이번 처리 대상 4건 · 접수 확인 1건 · 접수 확인 외 2건 · 처리 오류 1건/)).toBeVisible();
  await expect(panel.getByRole("alert")).toContainText("1건의 처리 결과를 확정하지 못했습니다");
  await expect(panel.getByRole("button", { name: "대기 발송" })).toBeEnabled();
  pending = undefined;
  await panel.getByRole("button", { name: "대기 발송" }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await pending!.fulfill({ json: { sentCount: 0, acceptedCount: 0, selectedCount: 0, otherCount: 0, errorCount: 0 } });
  await expect(panel.getByText(/이번 처리 대상 0건 · 접수 확인 0건/)).toBeVisible();
  await expect(panel.getByText(/대기 푸시를 처리하고 있습니다/)).toHaveCount(0);
  expect(calls).toBe(2);
});

test("관리자 푸시 일부 상세 필드가 없는 서버는 누락 건수를 0으로 표시하지 않는다", async ({ page }) => {
  await mockApi(page, { admin: true });
  await page.route("**/api/v1/admin/notifications/push**", route => route.fulfill({
    json: route.request().url().endsWith("/dispatch")
      ? { sentCount: 2, acceptedCount: 2, selectedCount: 5 } : pushDashboard,
  }));
  await openPushAdmin(page);
  const panel = page.locator(".admin-push-panel");
  await panel.getByRole("button", { name: "대기 발송" }).click();
  await expect(panel.getByText(/공급사 접수 확인 후 종료: 2건/)).toBeVisible();
  await expect(panel.getByText(/이번 처리 대상/)).toHaveCount(0);
  await expect(panel.getByRole("alert")).toHaveCount(0);
});

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

for (const phase of ["최초 조회", "결과 갱신"]) for (const status of [401, 403]) {
  test(`관리자 푸시 ${phase} ${status}에서 추가 요청을 차단한다`, async ({ page }) => {
    await mockApi(page, { admin: true });
    let posts = 0;
    let reads = 0;
    await page.route("**/api/v1/admin/notifications/push**", route => {
      if (route.request().method() === "POST") { posts++; return route.fulfill({ status: 204 }); }
      reads++;
      return phase === "최초 조회" || posts > 0
        ? route.fulfill({ status, json: { detail: "권한 없음" } })
        : route.fulfill({ json: pushDashboard });
    });
    await openPushAdmin(page);
    const panel = page.locator(".admin-push-panel");
    if (phase === "결과 갱신") await panel.getByRole("button", { name: "재시도", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("다시 로그인해주세요");
    await expect(panel.getByRole("button", { name: "현황 다시 불러오기" })).toHaveCount(0);
    if (phase === "결과 갱신") {
      await expect(panel.getByRole("button", { name: "대기 발송" })).toBeDisabled();
      await expect(panel.getByRole("button", { name: "새로고침" })).toBeDisabled();
    }
    expect(posts).toBe(phase === "최초 조회" ? 0 : 1);
    expect(reads).toBeGreaterThan(0);
  });
}

for (const oldStatus of [200, 403]) {
  test(`관리자 푸시 탭 전환 후 이전 조회 ${oldStatus} 응답을 무시한다`, async ({ page }) => {
    await mockApi(page, { admin: true });
    const pending: Route[] = [];
    let releaseNew = false;
    await page.route("**/api/v1/admin/notifications/push", route => {
      if (!releaseNew) { pending.push(route); return; }
      return route.fulfill({ json: pushDashboard });
    });
    await openPushAdmin(page);
    await expect.poll(() => pending.length).toBeGreaterThan(0);
    await page.getByRole("tab", { name: "공고 동기화" }).click();
    releaseNew = true;
    await page.getByRole("tab", { name: "푸시 발송" }).click();
    const panel = page.locator(".admin-push-panel");
    await expect(panel.getByRole("button", { name: "재시도", exact: true })).toBeEnabled();
    for (const route of pending) await route.fulfill({ status: oldStatus, json: oldStatus === 200
      ? { ...pushDashboard, recentFailures: [], permanentlyFailedCount: 0 } : { detail: "이전 요청 권한 만료" } });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(panel.getByText("실패한 푸시 공고", { exact: true })).toBeVisible();
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "재시도", exact: true })).toBeEnabled();
  });
}

test("관리자 푸시는 접수 확인·기기 없음·만료·확인 불가를 별도로 표시한다", async ({ page }) => {
  await mockApi(page, { admin: true });
  await page.route("**/api/v1/admin/notifications/push**", route => route.request().method() === "POST"
    ? route.fulfill({ json: { sentCount: 2, acceptedCount: 2 } })
    : route.fulfill({ json: { ...pushDashboard, sentLast24Hours: 2, noDevicesLast24Hours: 3, invalidTokensLast24Hours: 4, unknownLast24Hours: 5 } }));
  await openPushAdmin(page);
  const panel = page.locator(".admin-push-panel");
  for (const [label, count] of [["24시간 공급사 접수 확인", "2"], ["24시간 기기 없음 종료", "3"], ["24시간 토큰 만료 종료", "4"], ["24시간 결과 확인 불가", "5"]]) {
    await expect(panel.locator(".admin-sync-summary > div").filter({ hasText: label }).locator("strong")).toHaveText(count);
  }
  await panel.getByRole("button", { name: "대기 발송" }).click();
  await expect(panel.getByRole("status").filter({ hasText: "공급사 접수 확인 후 종료: 2건" })).toBeVisible();
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
  await expect(page.getByText("로그인이 만료되었거나 접근 권한이 없습니다. 다시 로그인한 뒤 알림 창을 열어주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "알림 설정 저장" })).toBeDisabled();
  expect(saves).toBe(1);
});

const inboxRows = [
  { id: 31, noticeId: 1, noticeTitle: "서울 접수 알림", type: "APPLY_START", eventDate: "2026-10-04", createdAt: "2026-10-01T00:00:00Z", message: "접수 시작을 확인하세요", readAt: null },
  { id: 32, noticeId: 2, noticeTitle: "부산 임대 알림", type: "NOTICE_UPDATED", eventDate: "2026-10-04", createdAt: "2026-10-03T00:00:00Z", message: "공고 변경을 확인하세요", readAt: "2026-10-03T01:00:00Z" },
  { id: 33, noticeId: 1, noticeTitle: "서울 마감 알림", type: "APPLY_DEADLINE_1D", eventDate: "2026-10-04", createdAt: "2026-10-02T00:00:00Z", message: "내일 마감입니다", readAt: null },
];

async function openMemberInbox(page: Page) {
  await page.goto("/");
  await signup(page);
  await page.getByRole("button", { name: /^알림 \d+개$/ }).click();
  await expect(page.getByLabel("알림 검색")).toBeVisible();
}

test("알림함 검색과 정렬은 추가 조회 없이 즉시 반영되고 모바일에서 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  let reads = 0;
  await page.route("**/api/v1/members/me/notifications", route => { reads++; return route.fulfill({ json: { notifications: inboxRows, unreadCount: 2 } }); });
  await openMemberInbox(page);
  const count = reads;
  const dialog = page.getByRole("dialog", { name: "맞춤 청약 알림" });
  await expect(dialog.locator(".notification-item").first()).toContainText("부산 임대 알림");
  await dialog.getByLabel("알림 정렬").selectOption("UNREAD_FIRST");
  await expect(dialog.locator(".notification-item").first()).toContainText("서울 마감 알림");
  await dialog.getByLabel("알림 검색").fill("서울   마감");
  await expect(dialog.locator(".notification-item")).toHaveCount(1);
  await expect(dialog.getByText("불러온 3건 중 1건 표시")).toBeVisible();
  await dialog.getByLabel("알림 검색").fill("존재하지 않음");
  await expect(dialog.getByText("검색 결과가 없어요")).toBeVisible();
  await dialog.getByRole("button", { name: "검색 초기화" }).click();
  await dialog.getByRole("button", { name: "변경 1", exact: true }).click();
  await expect(dialog.locator(".notification-item")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "변경 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(reads).toBe(count);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/notification-inbox-mobile.png" });
});

test("알림함 재진입 조회 실패는 이전 목록과 빈 알림 안내를 보여주지 않는다", async ({ page }) => {
  await mockApi(page);
  let fail = false;
  await page.route("**/api/v1/members/me/notifications", route => fail
    ? route.fulfill({ status: 503, json: { detail: "조회 실패" } })
    : route.fulfill({ json: { notifications: inboxRows, unreadCount: 2 } }));
  await openMemberInbox(page);
  await page.keyboard.press("Escape");
  fail = true;
  await page.getByRole("button", { name: "알림 2개", exact: true }).click();
  await expect(page.getByText("알림 목록을 확인하지 못했습니다. 새로고침으로 다시 불러와주세요.")).toBeVisible();
  await expect(page.locator(".notification-item")).toHaveCount(0);
  await expect(page.getByText("아직 도착한 알림이 없어요")).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.locator(".notification-item")).toHaveCount(3);
});

for (const action of ["읽음", "모두 읽음", "설정 저장"]) {
  test(`알림함 ${action} 동일 이벤트의 중복 요청과 교차 작업을 차단한다`, async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/v1/members/me/notifications", route => route.fulfill({ json: { notifications: [inboxRows[0]], unreadCount: 1 } }));
    let pending: Route | undefined;
    let writes = 0;
    await page.route("**/api/v1/members/me/notifications/**", route => {
      if (route.request().method() === "GET") return route.fallback();
      writes++; pending = route;
    });
    await openMemberInbox(page);
    const dialog = page.getByRole("dialog", { name: "맞춤 청약 알림" });
    if (action === "설정 저장") {
      await dialog.getByRole("tab", { name: "알림 설정" }).click();
      await dialog.locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
    } else {
      const button = action === "읽음" ? dialog.locator(".notification-item") : dialog.getByRole("button", { name: "모두 읽음" });
      await button.evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
    }
    await expect.poll(() => Boolean(pending)).toBe(true);
    expect(writes).toBe(1);
    await dialog.getByRole("tab", { name: "알림함", exact: false }).click();
    await expect(dialog.getByRole("button", { name: "모두 읽음" })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "새로고침", exact: true })).toBeDisabled();
    await expect(dialog.locator(".notification-item")).toBeDisabled();
    // Fail safely so all variants stay in the dialog and demonstrate lock recovery.
    await pending!.fulfill({ status: 503, json: { detail: "쓰기 실패" } });
    await expect(dialog.getByRole("button", { name: "모두 읽음" })).toBeEnabled();
    expect(writes).toBe(1);
  });
}

test("알림함 자동 갱신 실패는 이전 목록을 유지하고 수동 갱신으로 복구한다", async ({ page }) => {
  await mockApi(page);
  let fail = false;
  await page.route("**/api/v1/members/me/notifications", route => fail
    ? route.fulfill({ status: 503, json: { detail: "자동 갱신 실패" } })
    : route.fulfill({ json: { notifications: inboxRows, unreadCount: 2 } }));
  await openMemberInbox(page);
  fail = true;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText(/최근 알림을 갱신하지 못했습니다/)).toBeVisible();
  await expect(page.locator(".notification-item")).toHaveCount(3);
  fail = false;
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await expect(page.getByText(/최근 알림을 갱신하지 못했습니다/)).toHaveCount(0);
  await expect(page.locator(".notification-item")).toHaveCount(3);
});

for (const status of [401, 403]) {
  test(`알림함 자동 갱신 ${status} 이후 읽음과 새로고침을 차단한다`, async ({ page }) => {
    await mockApi(page);
    let denied = false;
    let reads = 0;
    await page.route("**/api/v1/members/me/notifications", route => { reads++; return denied
      ? route.fulfill({ status, json: { detail: "접근 거부" } })
      : route.fulfill({ json: { notifications: inboxRows, unreadCount: 2 } }); });
    await openMemberInbox(page);
    denied = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByText(/로그인이 만료되었거나 접근 권한/)).toBeVisible();
    const count = reads;
    await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "모두 읽음" })).toBeDisabled();
    await expect(page.locator(".notification-item").first()).toBeDisabled();
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(reads).toBe(count);
  });
}

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

const accountSessions = [
  { id: 2, clientName: "다른 브라우저", current: false, createdAt: "2026-10-04T00:00:00Z", expiresAt: "bad" },
  { id: 1, clientName: "현재 브라우저", current: true, createdAt: "2026-10-01T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z" },
];
async function openAccount(page: Page) {
  await page.goto("/"); await signup(page);
  await page.getByRole("button", { name: "테스트 회원", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "회원 관리" })).toBeVisible();
}

test("계정 보안 조회 실패와 빈 결과를 구분하고 기기·동의 내역을 각각 복구한다", async ({ page }) => {
  await mockApi(page);
  let recovered = false;
  for (const path of ["sessions", "policy-consents"]) await page.route(`**/api/v1/members/me/${path}`, route =>
    recovered ? route.fulfill({ json: [] }) : route.fulfill({ status: 503, json: { detail: "조회 실패" } }));
  await openAccount(page);
  const panel = page.locator(".account-access-panel");
  await expect(panel.getByRole("alert")).toHaveCount(2);
  await expect(panel.getByText("기록된 동의 내역이 없습니다.")).toHaveCount(0);
  await expect(panel.getByText("표시할 로그인 기기가 없습니다.")).toHaveCount(0);
  recovered = true;
  await panel.getByRole("button", { name: "기기 목록 새로고침" }).click();
  await panel.getByRole("button", { name: "동의 내역 새로고침" }).click();
  await expect(panel.getByText("기록된 동의 내역이 없습니다.")).toBeVisible();
  await expect(panel.getByText("표시할 로그인 기기가 없습니다.")).toBeVisible();
  await expect(panel.getByRole("alert")).toHaveCount(0);
});

test("계정 기기 종료는 확인·중복 차단·최신 목록 갱신까지 잠금을 유지한다", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/v1/members/me/policy-consents", route => route.fulfill({ json: [] }));
  let terminated = false;
  let writes = 0;
  let pendingWrite: Route | undefined;
  let pendingRead: Route | undefined;
  await page.route("**/api/v1/members/me/sessions", route => {
    if (terminated) { pendingRead = route; return; }
    return route.fulfill({ json: accountSessions });
  });
  await page.route("**/api/v1/members/me/sessions/2", route => { writes++; pendingWrite = route; });
  await openAccount(page);
  const panel = page.locator(".account-access-panel");
  await expect(panel.locator(".session-item").first()).toContainText("현재 브라우저");
  await expect(panel.locator(".session-item").first().getByRole("button", { name: "종료", exact: true })).toHaveCount(0);
  await expect(panel.getByText("날짜 확인 불가 자동 만료")).toBeVisible();
  await panel.getByRole("button", { name: "종료", exact: true }).click();
  await panel.getByRole("button", { name: "취소", exact: true }).click();
  expect(writes).toBe(0);
  await panel.getByRole("button", { name: "종료", exact: true }).click();
  await panel.getByRole("button", { name: "종료 확인" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect.poll(() => Boolean(pendingWrite)).toBe(true);
  expect(writes).toBe(1);
  terminated = true;
  await pendingWrite!.fulfill({ status: 204 });
  await expect.poll(() => Boolean(pendingRead)).toBe(true);
  await expect(panel.getByRole("button", { name: "기기 목록 새로고침" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "다른 기기 모두 종료" })).toBeDisabled();
  await pendingRead!.fulfill({ json: [accountSessions[1]] });
  await expect(panel.getByText("조회된 기기 1개 · 다른 기기 0개")).toBeVisible();
  await expect(panel.getByRole("button", { name: "기기 목록 새로고침" })).toBeEnabled();
  expect(writes).toBe(1);
});

for (const phase of ["종료 요청", "종료 후 조회"]) {
  test(`계정 ${phase} 실패는 재종료 없이 읽기 요청으로 복구한다`, async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/v1/members/me/policy-consents", route => route.fulfill({ json: [] }));
    let writes = 0;
    let recovered = false;
    await page.route("**/api/v1/members/me/sessions", route => {
      if (phase === "종료 후 조회" && writes && !recovered) return route.fulfill({ status: 503, json: { detail: "갱신 실패" } });
      return route.fulfill({ json: recovered ? [accountSessions[1]] : accountSessions });
    });
    await page.route("**/api/v1/members/me/sessions/2", route => {
      writes++;
      return phase === "종료 요청" ? route.fulfill({ status: 503, json: { detail: "결과 미확인" } }) : route.fulfill({ status: 204 });
    });
    await openAccount(page);
    const panel = page.locator(".account-access-panel");
    await panel.getByRole("button", { name: "종료", exact: true }).click();
    await panel.getByRole("button", { name: "종료 확인" }).click();
    await expect(panel.getByText(/추가 종료 전 기기 목록을 새로고침/)).toBeVisible();
    await expect(panel.getByRole("button", { name: "종료", exact: true })).toBeDisabled();
    recovered = true;
    await panel.getByRole("button", { name: "기기 목록 새로고침" }).click();
    await expect(panel.locator(".session-item")).toHaveCount(1);
    await expect(panel.getByRole("alert")).toHaveCount(0);
    expect(writes).toBe(1);
  });
}

test("닫힌 계정창의 동의 응답은 새 창의 내역을 덮어쓰지 않는다", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/v1/members/me/sessions", route => route.fulfill({ json: [] }));
  let old: Route | undefined;
  let reads = 0;
  await page.route("**/api/v1/members/me/policy-consents", route => {
    if (++reads === 1) { old = route; return; }
    return route.fulfill({ json: [{ policyType: "TERMS", policyVersion: "new-v2", agreedAt: "bad" }] });
  });
  await openAccount(page);
  await expect.poll(() => Boolean(old)).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "테스트 회원", exact: true }).click();
  await expect(page.getByText("new-v2 · 날짜 확인 불가")).toBeVisible();
  const response = page.waitForResponse(r => r.url().endsWith("/policy-consents") && r.status() === 403);
  await old!.fulfill({ status: 403, json: { detail: "old denied" } }); await response;
  await expect(page.getByText("new-v2 · 날짜 확인 불가")).toBeVisible();
  await expect(page.locator(".account-access-panel").getByRole("alert")).toHaveCount(0);
});

test("닫힌 계정창의 종료 실패는 새 창을 잠그지 않는다", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/v1/members/me/sessions", route => route.fulfill({ json: accountSessions }));
  await page.route("**/api/v1/members/me/policy-consents", route => route.fulfill({ json: [] }));
  let pending: Route | undefined;
  await page.route("**/api/v1/members/me/sessions/2", route => { pending = route; });
  await openAccount(page);
  const panel = page.locator(".account-access-panel");
  await panel.getByRole("button", { name: "종료", exact: true }).click();
  await panel.getByRole("button", { name: "종료 확인" }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "테스트 회원", exact: true }).click();
  await expect(panel.getByRole("button", { name: "종료", exact: true })).toBeEnabled();
  const response = page.waitForResponse(r => r.url().endsWith("/sessions/2"));
  await pending!.fulfill({ status: 401, json: { detail: "old expired" } }); await response;
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "종료", exact: true })).toBeEnabled();
});

for (const status of [401, 403]) {
  test(`계정 권한 오류 ${status}에서 기기와 동의 재조회를 모두 차단한다`, async ({ page }) => {
    await mockApi(page);
    let reads = 0;
    await page.route("**/api/v1/members/me/sessions", route => { reads++; return route.fulfill({ status, json: { detail: "denied" } }); });
    await page.route("**/api/v1/members/me/policy-consents", route => route.fulfill({ json: [] }));
    await openAccount(page);
    const panel = page.locator(".account-access-panel");
    await expect(panel.getByText(/로그인이 만료되었거나 권한이 없습니다/)).toBeVisible();
    await expect(panel.getByRole("button", { name: "기기 목록 새로고침" })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "동의 내역 새로고침" })).toBeDisabled();
    // Development StrictMode may start the mount read twice. After denial,
    // neither control may initiate another request.
    const initialReads = reads;
    expect(initialReads).toBeGreaterThan(0);
    await panel.getByRole("button", { name: "기기 목록 새로고침" }).evaluate((button: HTMLButtonElement) => button.click());
    await panel.getByRole("button", { name: "동의 내역 새로고침" }).evaluate((button: HTMLButtonElement) => button.click());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(reads).toBe(initialReads);
  });
}

test("계정 다른 기기 전체 종료와 모바일 레이아웃을 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  let writes = 0;
  await page.route("**/api/v1/members/me/policy-consents", route => route.fulfill({ json: [] }));
  await page.route("**/api/v1/members/me/sessions", route => route.fulfill({ json: writes ? [accountSessions[1]] : accountSessions }));
  await page.route("**/api/v1/members/me/sessions/others", route => { writes++; return route.fulfill({ json: [accountSessions[1]] }); });
  await openAccount(page);
  const panel = page.locator(".account-access-panel");
  await panel.getByRole("button", { name: "다른 기기 모두 종료" }).click();
  await expect(panel.getByText("현재 기기를 제외한 모든 기기를 종료할까요?")).toBeVisible();
  await panel.getByRole("button", { name: "종료 확인" }).click();
  await expect(panel.locator(".session-item")).toHaveCount(1);
  expect(writes).toBe(1);
  const dialog = page.getByRole("dialog", { name: "회원 관리" });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: "test-results/account-access-mobile.png", animations: "disabled" });
});

test("계정 종료 중 다른 조회의 권한 거부가 발생하면 후속 조회도 중단한다", async ({ page }) => {
  await mockApi(page);
  let denied = false;
  let reads = 0;
  let pending: Route | undefined;
  await page.route("**/api/v1/members/me/sessions", route => { reads++; return route.fulfill({ json: accountSessions }); });
  await page.route("**/api/v1/members/me/policy-consents", route => denied
    ? route.fulfill({ status: 403, json: { detail: "denied" } }) : route.fulfill({ json: [] }));
  await page.route("**/api/v1/members/me/sessions/2", route => { pending = route; });
  await openAccount(page);
  const panel = page.locator(".account-access-panel");
  await panel.getByRole("button", { name: "종료", exact: true }).click();
  await panel.getByRole("button", { name: "종료 확인" }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  denied = true;
  await panel.getByRole("button", { name: "동의 내역 새로고침" }).click();
  await expect(panel.getByText(/로그인이 만료되었거나 권한이 없습니다/)).toBeVisible();
  const before = reads;
  const response = page.waitForResponse(r => r.url().endsWith("/sessions/2"));
  await pending!.fulfill({ status: 204 }); await response;
  await expect(panel.getByText(/기기 종료 처리 중/)).toHaveCount(0);
  expect(reads).toBe(before);
});

async function openFavoriteSchedule(page: Page) {
  await page.goto("/");
  for (const item of notices) {
    await page.locator("article").filter({ hasText: item.title }).getByLabel(/관심청약 저장/).click();
  }
  await page.locator(".saved-button").click();
  await page.getByRole("button", { name: "전체 일정 보기" }).click();
  await expect(page.getByRole("dialog", { name: "관심청약 전체 일정" })).toBeVisible();
}

test("관심 일정 검색·월·유형 건수는 서버 재조회 없이 즉시 일치한다", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-20T00:00:00Z") });
  await mockApi(page);
  await openFavoriteSchedule(page);
  let requests = 0;
  page.on("request", request => { if (request.url().includes("/api/v1/notices")) requests++; });
  const dialog = page.getByRole("dialog", { name: "관심청약 전체 일정" });
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(5);
  await expect(dialog.getByRole("button", { name: "전체 5", exact: true })).toBeVisible();
  await expect(dialog.getByText("2026.09.20 · 오늘")).toBeVisible();
  await expect(dialog.getByText("2026.09.21 · D-1")).toBeVisible();
  await dialog.getByLabel("일정 월", { exact: true }).selectOption("2026-10");
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "전체 1", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "조건 초기화" }).click();
  await dialog.getByLabel("일정 공고 검색").fill("서울 강남구");
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(2);
  await dialog.getByRole("button", { name: "접수 마감 1", exact: true }).click();
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "접수 마감 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByLabel("일정 공고 검색").fill("없는 결과");
  await expect(dialog.getByText("조건에 맞는 일정이 없어요")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "조회 일정 저장" })).toBeDisabled();
  expect(requests).toBe(0);
});

test("관심 일정 파일은 현재 조회한 유형만 저장하고 원본 전체 일정은 보존한다", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-20T00:00:00Z") });
  await mockApi(page);
  await openFavoriteSchedule(page);
  const dialog = page.getByRole("dialog", { name: "관심청약 전체 일정" });
  await dialog.getByRole("button", { name: "접수 마감 2", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "조회 일정 저장" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("cheongyak-filtered-schedule.ics");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const content = Buffer.concat(chunks).toString("utf8");
  expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  expect(content).toContain("notice-1-apply-end");
  expect(content).toContain("notice-2-apply-end");
  expect(content).not.toContain("apply-start@");
  expect(content).not.toContain("-winner@");
  await expect(dialog.getByText(/현재 표시된 2개 일정의 파일 다운로드/)).toBeVisible();
  await dialog.getByRole("button", { name: "조건 초기화" }).click();
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(5);
});

test("관심 일정은 재열기에서 조건을 초기화하고 한국 날짜 변경을 반영한다", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-20T14:59:00Z") });
  await mockApi(page);
  await openFavoriteSchedule(page);
  const dialog = page.getByRole("dialog", { name: "관심청약 전체 일정" });
  await dialog.getByLabel("지난 일정도 보기").check();
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(6);
  await dialog.getByLabel("일정 공고 검색").fill("서울");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "전체 일정 보기" }).click();
  await expect(dialog.getByLabel("일정 공고 검색")).toHaveValue("");
  await expect(dialog.getByLabel("지난 일정도 보기")).not.toBeChecked();
  await page.clock.fastForward(65_000);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(dialog.getByText(/한국 날짜 2026-09-21 기준/)).toBeVisible();
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(4);
  await expect(dialog.getByText("2026.09.21 · 오늘")).toBeVisible();
});

test("관심 일정 파일 생성 실패는 오류를 표시하고 조건을 유지한다", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-09-20T00:00:00Z") });
  await mockApi(page);
  await openFavoriteSchedule(page);
  const dialog = page.getByRole("dialog", { name: "관심청약 전체 일정" });
  await dialog.getByLabel("일정 공고 검색").fill("서울");
  await page.evaluate(() => { URL.createObjectURL = () => { throw new Error("download unavailable"); }; });
  await dialog.getByRole("button", { name: "조회 일정 저장" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("일정 파일을 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
  await expect(dialog.getByLabel("일정 공고 검색")).toHaveValue("서울");
  await expect(dialog.locator(".favorite-calendar-event")).toHaveCount(2);
});

test("관심 일정 미정 안내와 모바일 레이아웃을 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date("2026-09-20T00:00:00Z") });
  await mockApi(page);
  await page.route(/\/api\/v1\/notices(?:\?|$)/, route => route.fulfill({ json: {
    content: notices.map(item => ({ ...item, applyStartDate: null, applyEndDate: null, winnerAnnounceDate: null })),
    number: 0, size: 24, totalElements: 2, totalPages: 1,
  } }));
  await openFavoriteSchedule(page);
  const dialog = page.getByRole("dialog", { name: "관심청약 전체 일정" });
  await expect(dialog.getByText(/관심 공고 2건은 확인 가능한 일정이 없습니다/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "조회 일정 저장" })).toBeDisabled();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/favorite-schedule-mobile.png", animations: "disabled" });
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

for (const width of [320, 360, 390, 430, 680]) {
  test(`모바일 탭 ${width}px에서 이름과 건수는 한 줄이며 마지막 탭과 검색 도구를 사용할 수 있다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockApi(page);
    await page.goto("/");
    // Wider font metrics must not expand the hero's grid track beyond 320px.
    if (width === 320) await page.addStyleTag({ content: "* { letter-spacing: 1px !important; }" });
    const tabs = page.getByRole("tablist", { name: "청약 상태" });
    await expect(tabs.getByRole("tab", { name: /모집 중·예정/ }).locator("b")).toHaveText("2");
    const metrics = await tabs.locator("button").evaluateAll(elements => elements.map(element => {
      const label = element.querySelector(".status-tab-label")!;
      const badge = element.querySelector("b")!;
      const a = label.getBoundingClientRect(); const b = badge.getBoundingClientRect();
      return { height: element.getBoundingClientRect().height, sameRow: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 2,
        singleLine: label.getClientRects().length === 1 && getComputedStyle(label).whiteSpace === "nowrap" };
    }));
    expect(metrics.every(item => item.height >= 44 && item.sameRow && item.singleLine)).toBe(true);
    await tabs.getByRole("tab", { name: /오픈 예정/ }).click();
    await expect(tabs.getByRole("tab", { name: /오픈 예정/ })).toHaveAttribute("aria-selected", "true");
    expect(await tabs.evaluate(container => {
      const selected = container.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
      const outer = container.getBoundingClientRect();
      return selected.left >= outer.left && selected.right <= outer.right;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: /청약 필터 열기/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    if (width === 390 || width === 320) {
      await page.evaluate(() => window.scrollTo({ top: document.querySelector(".dashboard")!.getBoundingClientRect().top + scrollY - 64, behavior: "instant" }));
      await page.screenshot({ path: "test-results/mobile-tabs-" + width + ".png", animations: "disabled" });
    }
  });
}

test("모바일 탭 긴 건수와 URL 복원·키보드 이동에서도 선택 탭을 한 줄로 드러낸다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await mockApi(page);
  await page.route("**/notices/facets?**", route => route.fulfill({ json: { total: 123456, endingToday: 12345, open: 12345, upcoming: 23456 } }));
  await page.goto("/?status=upcoming");
  const tabs = page.getByRole("tablist", { name: "청약 상태" });
  const last = tabs.getByRole("tab", { name: /오픈 예정/ });
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(last.locator("b")).toHaveText("23456");
  await expect.poll(() => tabs.evaluate(container => {
    const selected = container.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
    return selected.right <= container.getBoundingClientRect().right;
  })).toBe(true);
  await last.focus(); await page.keyboard.press("Home");
  await expect(tabs.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab").first()).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("모바일 관리자 탭은 한 줄이며 가로 이동과 키보드로 끝 메뉴에 접근한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page, { admin: true });
  await page.route("**/api/v1/admin/**", route => route.fulfill({ status: 503, json: { detail: "테스트 조회 오류" } }));
  await page.goto("/"); await signup(page);
  await page.getByRole("button", { name: "운영 관리" }).click();
  const tabs = page.getByRole("tablist", { name: "운영 관리 메뉴" });
  const tops = await tabs.getByRole("tab").evaluateAll(elements => elements.map(e => e.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  await tabs.getByRole("tab").first().focus(); await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: "AI 사용량" })).toHaveAttribute("aria-selected", "true");
  expect(await tabs.evaluate(element => element.scrollLeft > 0)).toBe(true);
  await page.keyboard.press("Home");
  await expect(tabs.getByRole("tab", { name: "공고 동기화" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("모바일 관심·일정 분류는 한 줄과 터치 영역을 유지하며 저장 동작 이름을 표시한다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await mockApi(page);
  await openFavoriteSchedule(page);
  const dialog = page.getByRole("dialog", { name: "관심청약 전체 일정" });
  const filters = dialog.getByRole("group", { name: "일정 유형 필터" });
  const metrics = await filters.locator("button").evaluateAll(elements => elements.map(e => ({ top: e.getBoundingClientRect().top, height: e.getBoundingClientRect().height, nowrap: getComputedStyle(e).whiteSpace })));
  expect(Math.max(...metrics.map(x => x.top)) - Math.min(...metrics.map(x => x.top))).toBeLessThan(1);
  await expect.poll(() => filters.locator("button").evaluateAll(elements => elements.every(e => e.getBoundingClientRect().height >= 44 && getComputedStyle(e).whiteSpace === "nowrap"))).toBe(true);
  await page.keyboard.press("Escape");
  const actions = page.locator(".section-actions");
  await expect(actions.getByRole("button", { name: "전체 일정 보기" })).toBeVisible();
  expect(await actions.getByRole("button", { name: "전체 일정 보기" }).evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("모바일 320px 회원 헤더의 아이콘 버튼은 이름이 있고 화면을 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await mockApi(page, { admin: true });
  await page.goto("/"); await signup(page);
  const header = page.locator(".header-actions");
  await expect(header.getByRole("button", { name: "운영 관리" })).toBeVisible();
  await expect(header.getByRole("button", { name: "관심청약 0개" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("데스크톱 상태 탭은 기존 아이콘과 네 열을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await mockApi(page); await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "청약 상태" });
  await expect(tabs.locator(".tab-icon").first()).toBeVisible();
  expect(await tabs.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const tops = await tabs.getByRole("tab").evaluateAll(elements => elements.map(e => e.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
});

const recommendationResult = {
  configured: true, dismissedCount: 2,
  recommendations: [1, 2, 3, 4, 5].map(id => ({ score: 90 - id, reasons: ["지역 일치", "주택유형 일치", "전체 추천 이유 확인"], notice: { ...notices[0], id, title: "맞춤 공고 " + id } })),
};

test("맞춤 추천 전체 펼치기와 이유 확인은 재조회 없이 동작하고 모바일에서 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  let reads = 0;
  await page.route("**/members/me/recommendations", route => { reads++; return route.fulfill({ json: recommendationResult }); });
  await page.goto("/"); await signup(page);
  const panel = page.locator(".recommendation-card");
  await expect(panel.locator(".recommendation-open")).toHaveCount(3);
  const initial = reads;
  await panel.getByRole("button", { name: "추천 5개 전체 보기" }).click();
  await expect(panel.locator(".recommendation-open")).toHaveCount(5);
  await panel.locator("summary").first().click();
  await expect(panel.getByText("전체 추천 이유 확인", { exact: true }).first()).toBeVisible();
  await panel.getByRole("button", { name: "추천 접기" }).click();
  await expect(panel.locator(".recommendation-open")).toHaveCount(3);
  expect(reads).toBe(initial);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: "test-results/recommendation-mobile.png", animations: "disabled" });
});

for (const malformed of [false, true]) {
  test(`맞춤 추천 ${malformed ? "잘못된 응답" : "조회 실패"}는 빈 결과로 표시하지 않고 새로고침으로 복구한다`, async ({ page }) => {
    await mockApi(page); let fail = true;
    await page.route("**/members/me/recommendations", route => fail
      ? route.fulfill({ status: malformed ? 200 : 503, json: malformed ? {} : { detail: "추천 조회 실패" } })
      : route.fulfill({ json: recommendationResult }));
    await page.goto("/"); await signup(page);
    const panel = page.locator(".recommendation-card");
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByText("현재 저장 조건에 맞는 접수 예정·접수중 공고가 없습니다.")).toHaveCount(0);
    fail = false; await panel.getByRole("button", { name: "추천 새로고침" }).click();
    await expect(panel.locator(".recommendation-open")).toHaveCount(3);
    await expect(panel.getByRole("alert")).toHaveCount(0);
  });
}

test("맞춤 추천 제외는 중복 클릭을 막고 결과 재조회까지 잠금을 유지한다", async ({ page }) => {
  await mockApi(page); let writes = 0; let changed = false; let releaseWrite!: () => void; let releaseRead!: () => void;
  const writeWait = new Promise<void>(resolve => { releaseWrite = resolve; });
  const readWait = new Promise<void>(resolve => { releaseRead = resolve; });
  await page.route("**/members/me/recommendations", async route => {
    if (changed) await readWait;
    await route.fulfill({ json: changed ? { ...recommendationResult, dismissedCount: 3, recommendations: recommendationResult.recommendations.slice(1) } : recommendationResult });
  });
  await page.route("**/recommendations/1/dismiss", async route => { writes++; await writeWait; changed = true; await route.fulfill({ status: 204 }); });
  await page.goto("/"); await signup(page);
  const panel = page.locator(".recommendation-card");
  const button = panel.getByRole("button", { name: "맞춤 공고 1 추천에서 제외" });
  await expect(button).toBeEnabled();
  await button.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
  await expect.poll(() => writes).toBe(1);
  await expect(panel.getByRole("button", { name: "추천 새로고침" })).toBeDisabled();
  releaseWrite();
  await expect(panel.getByText("추천 제외 요청을 처리했습니다.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "맞춤 공고 2 추천에서 제외" })).toBeDisabled();
  releaseRead();
  await expect(panel.getByText("불러온 추천 4개 · 숨김 3개")).toBeVisible();
  await expect(button).toHaveCount(0); expect(writes).toBe(1);
});

for (const postReadFailure of [false, true]) {
  test(`맞춤 추천 ${postReadFailure ? "변경 후 조회" : "변경 요청"} 실패는 추가 쓰기 없이 목록 조회로 복구한다`, async ({ page }) => {
    await mockApi(page); let writes = 0; let fail = false;
    await page.route("**/members/me/recommendations", route => fail && postReadFailure ? route.fulfill({ status: 503, json: { detail: "결과 조회 실패" } }) : route.fulfill({ json: recommendationResult }));
    await page.route("**/recommendations/1/dismiss", route => { writes++; fail = true; return route.fulfill({ status: postReadFailure ? 204 : 503, ...(postReadFailure ? {} : { json: { detail: "변경 결과 불명" } }) }); });
    await page.goto("/"); await signup(page);
    const panel = page.locator(".recommendation-card");
    await panel.getByRole("button", { name: "맞춤 공고 1 추천에서 제외" }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.getByText("아래는 이전 조회 결과입니다.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "맞춤 공고 2 추천에서 제외" })).toBeDisabled();
    fail = false; await panel.getByRole("button", { name: "추천 새로고침" }).click();
    await expect(panel.getByRole("button", { name: "맞춤 공고 2 추천에서 제외" })).toBeEnabled();
    expect(writes).toBe(1);
  });
}

test("맞춤 추천 전체 복원은 확인과 취소를 제공하고 서버 건수를 다시 확인한다", async ({ page }) => {
  await mockApi(page); let writes = 0;
  await page.route("**/members/me/recommendations", route => route.fulfill({ json: { ...recommendationResult, dismissedCount: writes ? 0 : 2 } }));
  await page.route("**/recommendations/dismissed", route => { writes++; return route.fulfill({ status: 204 }); });
  await page.goto("/"); await signup(page);
  const panel = page.locator(".recommendation-card");
  await panel.getByRole("button", { name: "숨긴 공고 2개 다시 보기" }).click();
  await panel.getByRole("button", { name: "취소", exact: true }).click(); expect(writes).toBe(0);
  await panel.getByRole("button", { name: "숨긴 공고 2개 다시 보기" }).click();
  await panel.getByRole("button", { name: "복원 확인" }).evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
  await expect(panel.getByText("불러온 추천 5개 · 숨김 0개")).toBeVisible(); expect(writes).toBe(1);
});

for (const status of [401, 403]) {
  test(`맞춤 추천 권한 ${status} 후 추가 조회와 변경을 막는다`, async ({ page }) => {
    await mockApi(page); let denied = false; let reads = 0;
    await page.route("**/members/me/recommendations", route => { reads++; return denied ? route.fulfill({ status, json: { detail: "권한 없음" } }) : route.fulfill({ json: recommendationResult }); });
    await page.goto("/"); await signup(page);
    const panel = page.locator(".recommendation-card");
    await expect(panel.locator(".recommendation-open")).toHaveCount(3);
    denied = true; await panel.getByRole("button", { name: "추천 새로고침" }).click();
    await expect(panel.getByText("로그인이 만료되었거나 권한이 없습니다. 다시 로그인해주세요.")).toBeVisible();
    const count = reads;
    await expect(panel.getByRole("button", { name: "추천 새로고침" })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "맞춤 공고 1 추천에서 제외" })).toBeDisabled();
    expect(reads).toBe(count);
  });
}

for (const lateStatus of [204, 401]) {
  test(`맞춤 추천 로그아웃 뒤 늦은 변경 ${lateStatus} 응답은 새 로그인에 영향을 주지 않는다`, async ({ page }) => {
    await mockApi(page); let reads = 0; let writes = 0; let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/members/me/recommendations", route => { reads++; return route.fulfill({ json: recommendationResult }); });
    await page.route("**/recommendations/1/dismiss", async route => { writes++; await wait; await route.fulfill({ status: lateStatus, ...(lateStatus === 204 ? {} : { json: { detail: "이전 세션 오류" } }) }); });
    await page.goto("/"); await signup(page);
    const panel = page.locator(".recommendation-card");
    await panel.getByRole("button", { name: "맞춤 공고 1 추천에서 제외" }).click();
    await expect.poll(() => writes).toBe(1);
    await page.getByRole("button", { name: "테스트 회원", exact: true }).click();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await signup(page);
    await expect(panel.getByRole("button", { name: "맞춤 공고 1 추천에서 제외" })).toBeEnabled();
    const count = reads; release();
    await page.waitForTimeout(200);
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await expect(panel.getByText("추천 제외 요청을 처리했습니다.")).toHaveCount(0);
    expect(reads).toBe(count);
  });
}

for (const lateStatus of [200, 403]) {
  test(`맞춤 추천 로그아웃 뒤 늦은 조회 ${lateStatus} 응답은 새 추천을 덮어쓰지 않는다`, async ({ page }) => {
    await mockApi(page); let delayed = false; let reads = 0; let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/members/me/recommendations", async route => {
      reads++;
      if (delayed) {
        delayed = false; await wait;
        return route.fulfill({ status: lateStatus, json: lateStatus === 200 ? { ...recommendationResult, recommendations: [] } : { detail: "이전 조회 오류" } });
      }
      return route.fulfill({ json: recommendationResult });
    });
    await page.goto("/"); await signup(page);
    const panel = page.locator(".recommendation-card");
    await expect(panel.getByRole("button", { name: "추천 새로고침" })).toBeEnabled();
    const initial = reads; delayed = true;
    await panel.getByRole("button", { name: "추천 새로고침" }).evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
    await expect.poll(() => reads).toBe(initial + 1);
    await page.getByRole("button", { name: "테스트 회원", exact: true }).click();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await signup(page);
    await expect(panel.getByRole("button", { name: "맞춤 공고 1 추천에서 제외" })).toBeEnabled();
    release(); await page.waitForTimeout(200);
    await expect(panel.locator(".recommendation-open")).toHaveCount(3);
    await expect(panel.getByRole("alert")).toHaveCount(0);
  });
}

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
