import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteSearchPreference,
  deleteEligibilityProfile,
  clearComparisons,
  confirmEmailVerification,
  dismissMemberRecommendation,
  fetchAdminAuditLogs,
  fetchAdminMembers,
  fetchAdminSyncDashboard,
  fetchCurrentMember,
  fetchNotice,
  fetchNoticeChanges,
  fetchNoticeFacets,
  fetchNoticePage,
  fetchComparisonIds,
  fetchMemberSessions,
  fetchMemberRecommendations,
  fetchNotificationInbox,
  fetchNotificationPreference,
  fetchSearchPreference,
  fetchEligibilityProfile,
  loginMember,
  mergeComparisonIds,
  mergeFavoriteIds,
  revokeMemberSession,
  revokeOtherMemberSessions,
  resetDismissedRecommendations,
  requestEmailVerification,
  requestPasswordReset,
  reactivateAdminMember,
  resetPasswordWithToken,
  revokeAdminMemberSessions,
  markAllNotificationsRead,
  markNotificationRead,
  saveSearchPreference,
  saveEligibilityProfile,
  saveNotificationPreference,
  setFavorite,
  setComparison,
  suspendAdminMember,
  unlockAdminMember,
} from "../src/api.ts";

test("notice detail request returns expanded announcement fields", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "/api/v1/notices/77");
    assert.equal(init.credentials, "include");
    return new Response(JSON.stringify({
      id: 77,
      title: "상세 공고",
      businessEntityName: "테스트 사업주체",
      moveInPlannedMonth: "202812",
      contentChangedAt: "2026-09-08T01:00:00Z",
      lastChangeSummary: "접수 일정, 문의처",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const detail = await fetchNotice(77);
    assert.equal(detail.businessEntityName, "테스트 사업주체");
    assert.equal(detail.moveInPlannedMonth, "202812");
    assert.equal(detail.lastChangeSummary, "접수 일정, 문의처");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("notice change history is loaded from the detail resource", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "/api/v1/notices/77/changes");
    return new Response(JSON.stringify([{ id: 1, summary: "접수 일정, 문의처", changedAt: "2026-09-08T01:00:00Z" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const changes = await fetchNoticeChanges(77);
    assert.equal(changes[0].summary, "접수 일정, 문의처");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("notice search sends server filters and fetches matching counts", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const body = String(url).includes("/facets")
      ? { total: 7, endingToday: 1, open: 3, upcoming: 2 }
      : { content: [], number: 1, size: 24, totalElements: 7, totalPages: 2 };
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await fetchNoticePage({ category: "APARTMENT", status: "OPEN", keyword: " 은평 ", region: "서울", sort: "DEADLINE", page: 1 });
    await fetchNoticeFacets({ category: "APARTMENT", keyword: "은평", region: "서울" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const pageUrl = new URL(urls[0], "https://example.com");
  assert.equal(pageUrl.searchParams.get("page"), "1");
  assert.equal(pageUrl.searchParams.get("size"), "24");
  assert.equal(pageUrl.searchParams.get("sort"), "DEADLINE");
  assert.equal(pageUrl.searchParams.get("category"), "APARTMENT");
  assert.equal(pageUrl.searchParams.get("status"), "OPEN");
  assert.equal(pageUrl.searchParams.get("keyword"), "은평");
  assert.ok(urls[1].startsWith("/api/v1/notices/facets?"));
  assert.ok(!urls[1].includes("page="));
});

test("member requests include the HttpOnly session cookie and expected methods", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: "CHEONGYAK_CSRF=csrf-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    const response = String(url).includes("favorites")
      ? { noticeIds: [11, 12] }
      : { id: 1, email: "member@example.com", nickname: "회원", createdAt: "2026-09-03T00:00:00Z" };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await loginMember("member@example.com", "password-1234");
    await mergeFavoriteIds([11]);
    await setFavorite(11, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[1].init.method, "POST");
  assert.equal(requests[2].init.method, "DELETE");
  assert.equal(new Headers(requests[0].init.headers).get("Content-Type"), "application/json");
  assert.equal(new Headers(requests[1].init.headers).get("X-CSRF-Token"), "csrf-token");
});

test("saved search preference uses authenticated CRUD requests", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: "theme=light; CHEONGYAK_CSRF=saved-search-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    if ((init?.method ?? "GET") === "DELETE") return new Response(null, { status: 204 });
    return new Response(JSON.stringify({
      region: "서울",
      housingCategory: "APARTMENT",
      status: "OPEN",
      sort: "DEADLINE",
      updatedAt: "2026-09-04T00:00:00Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const saved = await saveSearchPreference({
      region: "서울",
      housingCategory: "APARTMENT",
      status: "OPEN",
      sort: "DEADLINE",
    });
    assert.equal(saved.region, "서울");
    assert.equal((await fetchSearchPreference())?.sort, "DEADLINE");
    await deleteSearchPreference();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.equal(requests[0].init.method, "PUT");
  assert.equal(requests[1].init.method, undefined);
  assert.equal(requests[2].init.method, "DELETE");
  assert.equal(new Headers(requests[0].init.headers).get("X-CSRF-Token"), "saved-search-token");
  assert.equal(new Headers(requests[2].init.headers).get("X-CSRF-Token"), "saved-search-token");
});

test("eligibility profile uses authenticated CRUD requests", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: "CHEONGYAK_CSRF=eligibility-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if ((init?.method ?? "GET") === "DELETE") return new Response(null, { status: 204 });
    return new Response(JSON.stringify({
      homeless: "YES",
      subscriptionAccount: "UNKNOWN",
      newlywed: "NO",
      firstHome: "YES",
      updatedAt: "2026-09-09T00:00:00Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const input = { homeless: "YES", subscriptionAccount: "UNKNOWN", newlywed: "NO", firstHome: "YES" };
    assert.equal((await fetchEligibilityProfile())?.homeless, "YES");
    assert.equal((await saveEligibilityProfile(input)).firstHome, "YES");
    await deleteEligibilityProfile();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.deepEqual(requests.map((request) => request.init.method ?? "GET"), ["GET", "PUT", "DELETE"]);
  assert.ok(requests.every((request) => request.url === "/api/v1/members/me/eligibility-profile"));
  assert.equal(new Headers(requests[1].init.headers).get("X-CSRF-Token"), "eligibility-token");
  assert.equal(new Headers(requests[2].init.headers).get("X-CSRF-Token"), "eligibility-token");
});

test("comparison list uses authenticated account synchronization endpoints", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: "CHEONGYAK_CSRF=comparison-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ noticeIds: [21, 22] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    assert.deepEqual(await fetchComparisonIds(), [21, 22]);
    assert.deepEqual(await mergeComparisonIds([22, 23]), [21, 22]);
    await setComparison(23, true);
    await setComparison(21, false);
    await clearComparisons();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.deepEqual(requests.map((request) => request.init.method ?? "GET"), ["GET", "POST", "PUT", "DELETE", "DELETE"]);
  assert.equal(requests[1].url, "/api/v1/members/me/comparisons/merge");
  assert.equal(JSON.parse(requests[1].init.body).noticeIds.length, 2);
  assert.equal(requests[4].url, "/api/v1/members/me/comparisons");
  assert.equal(new Headers(requests[1].init.headers).get("X-CSRF-Token"), "comparison-token");
  assert.equal(new Headers(requests[4].init.headers).get("X-CSRF-Token"), "comparison-token");
});

test("session bootstrap treats only 401 as a logged-out visitor", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: "로그인이 필요합니다." }),
    { status: 401, headers: { "Content-Type": "application/problem+json" } },
  );
  try {
    assert.equal(await fetchCurrentMember(), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("email verification and password reset use one-time token endpoints", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    const status = String(url).endsWith("/request") ? 202 : 204;
    return new Response(null, { status });
  };

  try {
    await requestEmailVerification("member@example.com");
    await confirmEmailVerification("verification-token");
    await requestPasswordReset("member@example.com");
    await resetPasswordWithToken("reset-token", "New-password-2!");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests.map((request) => request.url), [
    "/api/v1/auth/email-verification/request",
    "/api/v1/auth/email-verification/confirm",
    "/api/v1/auth/password-reset/request",
    "/api/v1/auth/password-reset/confirm",
  ]);
  assert.ok(requests.every((request) => request.init.method === "POST"));
  assert.equal(JSON.parse(requests[1].init.body).token, "verification-token");
  assert.equal(JSON.parse(requests[3].init.body).newPassword, "New-password-2!");
});

test("API problem detail is shown to the member", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: "로그인 시도가 많아 잠시 잠겼습니다." }),
    { status: 429, headers: { "Content-Type": "application/problem+json" } },
  );
  try {
    await assert.rejects(
      () => loginMember("member@example.com", "wrong-password"),
      /로그인 시도가 많아/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("login session management uses CSRF-protected member endpoints", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: "CHEONGYAK_CSRF=session-management-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/sessions/7")) return new Response(null, { status: 204 });
    return new Response(JSON.stringify([{
      id: 3,
      clientName: "Chrome · Windows",
      createdAt: "2026-09-04T00:00:00Z",
      expiresAt: "2026-10-04T00:00:00Z",
      current: true,
    }]), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    assert.equal((await fetchMemberSessions())[0].current, true);
    await revokeMemberSession(7);
    assert.equal((await revokeOtherMemberSessions()).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.equal(requests[0].url, "/api/v1/members/me/sessions");
  assert.equal(requests[0].init.method, undefined);
  assert.equal(requests[1].url, "/api/v1/members/me/sessions/7");
  assert.equal(requests[1].init.method, "DELETE");
  assert.equal(requests[2].url, "/api/v1/members/me/sessions/others");
  assert.equal(requests[2].init.method, "DELETE");
  assert.equal(new Headers(requests[1].init.headers).get("X-CSRF-Token"), "session-management-token");
  assert.equal(new Headers(requests[2].init.headers).get("X-CSRF-Token"), "session-management-token");
});

test("notification inbox and preferences use authenticated CSRF requests", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: "CHEONGYAK_CSRF=notification-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/read-all")) return new Response(null, { status: 204 });
    if (String(url).endsWith("/preference")) {
      return new Response(JSON.stringify({
        applyStartEnabled: true,
        deadline7dEnabled: false,
        deadline3dEnabled: true,
        deadline1dEnabled: true,
        winnerEnabled: true,
        newMatchingNoticeEnabled: true,
        noticeUpdatedEnabled: true,
        emailEnabled: false,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).endsWith("/9/read")) {
      return new Response(JSON.stringify({ id: 9, readAt: "2026-09-04T00:00:00Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ notifications: [], unreadCount: 2 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    assert.equal((await fetchNotificationInbox()).unreadCount, 2);
    await markNotificationRead(9);
    await markAllNotificationsRead();
    assert.equal((await fetchNotificationPreference()).deadline7dEnabled, false);
    await saveNotificationPreference({
      applyStartEnabled: true,
      deadline7dEnabled: false,
      deadline3dEnabled: true,
      deadline1dEnabled: true,
      winnerEnabled: true,
      newMatchingNoticeEnabled: true,
      noticeUpdatedEnabled: true,
      emailEnabled: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.deepEqual(requests.map((request) => request.init.method ?? "GET"), ["GET", "PATCH", "POST", "GET", "PUT"]);
  assert.equal(new Headers(requests[1].init.headers).get("X-CSRF-Token"), "notification-token");
  assert.equal(new Headers(requests[2].init.headers).get("X-CSRF-Token"), "notification-token");
  assert.equal(new Headers(requests[4].init.headers).get("X-CSRF-Token"), "notification-token");
  assert.equal(JSON.parse(requests[4].init.body).emailEnabled, true);
  assert.equal(JSON.parse(requests[4].init.body).newMatchingNoticeEnabled, true);
  assert.equal(JSON.parse(requests[4].init.body).noticeUpdatedEnabled, true);
});

test("member recommendations use the authenticated recommendation endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const requests = [];
  globalThis.document = { cookie: "CHEONGYAK_CSRF=recommendation-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if ((init.method ?? "GET") !== "GET") return new Response(null, { status: 204 });
    return new Response(JSON.stringify({
      configured: true,
      dismissedCount: 0,
      recommendations: [{ score: 95, reasons: ["아파트 유형 일치"], notice: { id: 7 } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await fetchMemberRecommendations();
    assert.equal(result.recommendations[0].score, 95);
    await dismissMemberRecommendation(7);
    await resetDismissedRecommendations();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.deepEqual(requests.map((request) => request.init.method ?? "GET"), ["GET", "POST", "DELETE"]);
  assert.equal(requests[0].url, "/api/v1/members/me/recommendations");
  assert.equal(requests[1].url, "/api/v1/members/me/recommendations/7/dismiss");
  assert.equal(requests[2].url, "/api/v1/members/me/recommendations/dismissed");
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(new Headers(requests[1].init.headers).get("X-CSRF-Token"), "recommendation-token");
  assert.equal(new Headers(requests[2].init.headers).get("X-CSRF-Token"), "recommendation-token");
});

test("admin sync dashboard uses the authenticated operations endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({
      generatedAt: "2026-09-04T00:00:00Z",
      runningCount: 0,
      failuresLast24Hours: 1,
      executions: [{ id: 3, status: "FAILED", fetchedCount: 0, savedCount: 0 }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await fetchAdminSyncDashboard();
    assert.equal(result.failuresLast24Hours, 1);
    assert.equal(result.executions[0].status, "FAILED");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request.url, "/api/v1/admin/sync-executions");
  assert.equal(request.init.method ?? "GET", "GET");
  assert.equal(request.init.credentials, "include");
});

test("admin member management searches, unlocks, revokes, and changes status with CSRF", async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: "CHEONGYAK_CSRF=admin-member-token" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    if ((init.method ?? "GET") === "DELETE") return new Response(null, { status: 204 });
    if (String(url).endsWith("/unlock")) {
      return new Response(JSON.stringify({ id: 7, failedLoginAttempts: 0, activeSessionCount: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ members: [{ id: 7 }], page: 0, size: 20, totalElements: 1, totalPages: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await fetchAdminMembers("member@example.com", "ACTIVE", 0);
    assert.equal(result.totalElements, 1);
    await unlockAdminMember(7);
    await revokeAdminMemberSessions(7);
    await suspendAdminMember(7, "운영정책 위반");
    await reactivateAdminMember(7);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  assert.equal(requests[0].url, "/api/v1/admin/members?page=0&size=20&query=member%40example.com&status=ACTIVE");
  assert.deepEqual(requests.map((request) => request.init.method ?? "GET"), ["GET", "POST", "DELETE", "POST", "POST"]);
  assert.equal(new Headers(requests[1].init.headers).get("X-CSRF-Token"), "admin-member-token");
  assert.equal(new Headers(requests[2].init.headers).get("X-CSRF-Token"), "admin-member-token");
  assert.equal(new Headers(requests[3].init.headers).get("X-CSRF-Token"), "admin-member-token");
  assert.equal(JSON.parse(requests[3].init.body).reason, "운영정책 위반");
});

test("admin audit history uses the authenticated read endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify([{
      id: 1,
      action: "MEMBER_SESSIONS_REVOKED",
      actorEmail: "admin@example.com",
      targetEmail: "member@example.com",
      affectedCount: 2,
    }]), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const logs = await fetchAdminAuditLogs();
    assert.equal(logs[0].affectedCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(request.url, "/api/v1/admin/audit-logs");
  assert.equal(request.init.credentials, "include");
});
