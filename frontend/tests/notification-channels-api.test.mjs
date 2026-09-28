import assert from "node:assert/strict";
import test from "node:test";
import { fetchNotificationChannelAvailability } from "../src/notificationChannelsApi.ts";

test("notification channel availability uses the authenticated member endpoint", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "/api/v1/members/me/notifications/channels");
    assert.equal(init.credentials, "include");
    return new Response(JSON.stringify({ channels: [{ id: "SMS", label: "문자", available: false, message: "준비 중" }] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const response = await fetchNotificationChannelAvailability();
    assert.equal(response.channels[0].id, "SMS");
    assert.equal(response.channels[0].available, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
