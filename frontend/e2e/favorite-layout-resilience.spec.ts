import { expect, test } from "@playwright/test";

for (const width of [1440, 1331, 1024, 768, 390, 320]) {
  test(`관심청약 레이아웃: 준비 현황·검색·일정이 겹치지 않는다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date("2026-11-05T03:00:00Z"));
    const savedProfile = width !== 1331 && width !== 320;
    const items = [1, 2, 3, 4].map(id => ({
      id, sourceSystem: "REB_APT", housingCategory: "APARTMENT", status: id === 4 ? "ANNOUNCED" : "UPCOMING",
      title: id === 4 ? "발표 확인 대상 공고" : `서울 역세권 장기전세 및 공공분양 준비 공고 ${id}`,
      regionCode: "서울", address: "서울특별시", noticeDate: "2026-11-01",
      applyStartDate: id === 4 ? "2026-11-02" : "2026-11-09", applyEndDate: id === 4 ? "2026-11-03" : "2026-11-11",
      winnerAnnounceDate: id === 4 ? "2026-11-05" : "2026-11-20", totalUnits: 100,
      officialUrl: "https://example.invalid/notice", syncedAt: "2026-11-05T00:00:00Z", unitTypes: [],
    }));
    await page.route("**/api/v1/**", route => {
      const path = new URL(route.request().url()).pathname;
      const json = (value: unknown) => route.fulfill({ json: value });
      if (path === "/api/v1/notices") return json({ content: items, number: 0, size: 24, totalElements: 4, totalPages: 1 });
      if (path.endsWith("/facets")) return json({ total: 4, endingToday: 0, open: 0, upcoming: 3 });
      if (path.endsWith("/freshness")) return json({ generatedAt: "2026-11-05T00:00:00Z" });
      if (path === "/api/v1/members/me") return json({ id: 42, nickname: "레이아웃 회원", role: "MEMBER", emailVerified: true });
      if (path.endsWith("/favorites")) return json({ noticeIds: [1, 2, 3, 4] });
      if (path.endsWith("/comparisons")) return json({ noticeIds: [] });
      if (path.endsWith("/favorites/tracker")) return json(items.map((item, i) => ({ noticeId: item.id, progress: ["SAVED", "CHECKING", "READY", "APPLIED"][i], applicationResult: "PENDING", memo: "준비 메모", noticeDocumentChecked: false, eligibilityChecked: false, scheduleChecked: false, fundsChecked: false })));
      if (path.endsWith("/saved-search-profiles")) return json([]);
      if (path.endsWith("/eligibility-profile")) return savedProfile ? json({ homeless: "YES", subscriptionAccount: "YES", newlywed: "NO", firstHome: "NO", updatedAt: "2026-11-01T00:00:00Z" }) : route.fulfill({ status: 204 });
      if (path.endsWith("/search-preference")) return route.fulfill({ status: 204 });
      if (path.endsWith("/recommendations")) return json({ configured: false, recommendations: [], dismissedCount: 0 });
      if (path.endsWith("/notifications")) return json({ notifications: [], unreadCount: 0 });
      const item = items.find(item => path === `/api/v1/notices/${item.id}`);
      return item ? json(item) : json([]);
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "레이아웃 회원", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "관심청약 4개", exact: true }).click();
    const summary = page.getByRole("region", { name: "관심청약 준비 현황", exact: true });
    await expect(summary).toBeVisible();
    await expect(summary.locator(".favorite-upcoming-events li")).not.toHaveCount(0);
    await expect(summary.locator(".favorite-result-due-events li")).toHaveCount(1);
    await expect(page.locator(".application-list article")).toHaveCount(4);
    await summary.screenshot({ path: testInfo.outputPath("favorite-layout.png"), animations: "disabled" });

    // Text visibility alone misses flex compression: verify readable full-width
    // sections, vertical ordering, and an actually usable search field.
    const layout = await summary.evaluate(root => {
      const outer = root.getBoundingClientRect();
      const style = getComputedStyle(root);
      const innerWidth = outer.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2;
      const sections = [...root.children].map(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width }; });
      const input = root.querySelector("input")!.getBoundingClientRect();
      const copy = root.querySelector(".favorite-eligibility-status > div")!.getBoundingClientRect();
      return { sections, innerWidth, inputWidth: input.width, copyWidth: copy.width, fits: root.scrollWidth <= root.clientWidth };
    });
    expect(layout.fits).toBe(true);
    for (const section of layout.sections) expect(section.width).toBeGreaterThanOrEqual(layout.innerWidth - 2);
    for (let i = 1; i < layout.sections.length; i++) expect(layout.sections[i].top).toBeGreaterThanOrEqual(layout.sections[i - 1].bottom);
    expect(layout.copyWidth).toBeGreaterThanOrEqual(180);
    expect(layout.inputWidth).toBeGreaterThanOrEqual(160);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await summary.getByRole("button", { name: savedProfile ? "조회·수정" : "사전점검 시작", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "청약 조건 사전점검", exact: true })).toBeVisible();
    await page.getByRole("dialog", { name: "청약 조건 사전점검", exact: true }).getByRole("button", { name: "닫기", exact: true }).click();
    const search = page.getByPlaceholder("공고명, 지역, 내 메모");
    await search.fill("준비 공고 1");
    await expect(page.locator(".application-list article")).toHaveCount(1);
    await search.fill("");
    await summary.getByRole("button", { name: "신청 준비 완료 1", exact: true }).click();
    await expect(page.locator(".application-list article")).toHaveCount(1);
    await summary.getByRole("button", { name: "전체 4", exact: true }).click();
    await summary.locator(".favorite-upcoming-events button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
