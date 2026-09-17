import { expect, Page, test } from "@playwright/test";

const notices = [
  { id: 1, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: "OPEN", title: "E2E 서울 공공분양", regionCode: "서울", address: "서울특별시 강남구", noticeDate: "2026-09-01", applyStartDate: "2026-09-10", applyEndDate: "2026-09-20", winnerAnnounceDate: "2026-09-30", totalUnits: 120, minPrice: 500000000, maxPrice: 600000000, officialUrl: "https://applyhome.example/1", syncedAt: "2026-09-01T00:00:00Z" },
  { id: 2, sourceSystem: "MYHOME_PUBLIC_RENTAL", housingCategory: "PUBLIC_RENTAL", status: "UPCOMING", title: "E2E 경기 행복주택", regionCode: "경기", address: "경기도 고양시", noticeDate: "2026-09-02", applyStartDate: "2026-09-21", applyEndDate: "2026-09-25", winnerAnnounceDate: "2026-10-03", totalUnits: 80, officialUrl: "https://applyhome.example/2", syncedAt: "2026-09-01T00:00:00Z" },
];

async function mockApi(page: Page) {
  let member: Record<string, unknown> | undefined;
  let favoriteIds: number[] = [];
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
    if (path === "/api/v1/notices/facets") return json({ total: notices.length, endingToday: 0, open: 1, upcoming: 1 });
    if (path === "/api/v1/notices") return json({ content: notices, number: 0, size: 24, totalElements: notices.length, totalPages: 1 });
    const detail = path.match(/^\/api\/v1\/notices\/(\d+)$/);
    if (detail) return json(notices.find((notice) => notice.id === Number(detail[1])));
    if (path.endsWith("/changes")) return json([]);
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

test("비회원도 관심청약 저장과 공고 비교를 할 수 있다", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await page.locator("article").filter({ hasText: "E2E 서울 공공분양" }).getByLabel(/관심청약 저장/).click();
  await page.locator(".saved-button").click();
  await expect(page.getByRole("heading", { name: "E2E 서울 공공분양" })).toBeVisible();
  await page.locator(".saved-button").click();
  await page.getByRole("button", { name: "비교 담기" }).nth(0).click();
  await page.getByRole("button", { name: "비교 담기" }).nth(0).click();
  await page.getByRole("button", { name: "비교하기" }).click();
  await expect(page.getByRole("heading", { name: "청약 공고 비교" })).toBeVisible();
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
  await page.getByRole("button", { name: /지역·유형·예산 필터/ }).click();
  await expect(page.getByText("서울 기본 조건")).toBeVisible();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await expect(page.getByRole("heading", { name: "저장 조건 수정" })).toBeVisible();
  await page.getByLabel("조건 이름").fill("서울 아파트 조건");
  await page.getByLabel("지역").selectOption("경기");
  await page.getByLabel("최소 예산 (만원)").fill("30000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("저장 조건을 수정했습니다.")).toBeVisible();
  await expect(page.getByText(/경기 · 아파트 · 30,000만원 이상/)).toBeVisible();
  await page.getByRole("button", { name: "신규 알림 켜짐", exact: true }).click();
  await expect(page.getByRole("button", { name: "신규 알림 꺼짐", exact: true })).toBeVisible();
});
