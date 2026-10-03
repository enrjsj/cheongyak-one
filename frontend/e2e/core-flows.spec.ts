import { expect, Page, test } from "@playwright/test";

const notices = [
  { id: 1, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", title: "E2E 서울 공공분양", regionCode: "서울", address: "서울특별시 강남구", noticeDate: "2026-09-01", applyStartDate: "2026-09-10", applyEndDate: "2026-09-20", winnerAnnounceDate: "2026-09-30", totalUnits: 120, minPrice: 500000000, maxPrice: 600000000, officialUrl: "https://applyhome.example/1", syncedAt: "2026-09-01T00:00:00Z" },
  { id: 2, sourceSystem: "MYHOME_PUBLIC_RENTAL", housingCategory: "PUBLIC_RENTAL", status: "UPCOMING", title: "E2E 경기 행복주택", regionCode: "경기", address: "경기도 고양시", noticeDate: "2026-09-02", applyStartDate: "2026-09-21", applyEndDate: "2026-09-25", winnerAnnounceDate: "2026-10-03", totalUnits: 80, officialUrl: "https://applyhome.example/2", syncedAt: "2026-09-01T00:00:00Z" },
];

async function mockApi(page: Page, options: { failInitialNoticeLoad?: boolean; failNoticeLoads?: number; noticeFailureStatus?: number; failFacetLoads?: number; facetFailureStatus?: number } = {}) {
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
      member = { id: 1, email: input.email, nickname: input.nickname, role: "MEMBER", emailVerified: true, ...input, createdAt: "2026-09-01T00:00:00Z" };
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
  await panel.getByRole("button", { name: "확인 항목 정리하기" }).click();
  await expect(panel.getByRole("button", { name: "답변 생성 중…" })).toBeDisabled();
  await panel.getByRole("button", { name: "응답 대기 취소" }).click();
  await expect(panel.getByRole("alert")).toContainText("응답 대기를 취소했습니다");
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/ai-consultation-mobile.png" });
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
