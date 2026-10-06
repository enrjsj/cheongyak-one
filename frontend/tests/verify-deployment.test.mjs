import test from "node:test";
import assert from "node:assert/strict";
import { verifyDeployment } from "../../scripts/verify-deployment.mjs";

const revision = "a".repeat(40);
const success = async url => {
  if (url.includes("release")) return Response.json({ revision });
  if (url.includes("/admin/") || url.includes("/members/")) return new Response("{}", { status: 401, headers: { "cache-control": "no-store" } });
  if (url.endsWith("/health")) return Response.json({ status: "UP" });
  if (url.endsWith("/freshness")) return Response.json({ generatedAt: "2026-10-06T00:00:00Z" });
  return new Response('<div id="root"></div>', { headers: { "content-type": "text/html" } });
};

test("deployment waits for both revisions, retries smoke failures and preserves all attempts", async () => {
  let time = 0; let smokeCalls = 0;
  const report = await verifyDeployment("https://web.example", "https://api.example", revision, {
    now: () => time, pause: async ms => { time += ms; }, intervalMs: 10, deadlineMs: 100,
    request: async (url, init) => {
      assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error");
      if (url.includes("/api/v1/release") && time < 10) return Response.json({ revision: "b".repeat(40) });
      if (!url.includes("release")) { smokeCalls++; assert.ok(time >= 10); }
      if (url.endsWith("/health") && time < 20) return new Response("", { status: 503 });
      return success(url);
    },
  });
  assert.equal(report.ok, true); assert.equal(report.attempts.length, 3);
  assert.equal(report.attempts[0].webReady, true); assert.equal(report.attempts[0].apiReady, false);
  assert.equal(report.attempts[1].checks.find(check => check.name === "health").reason, "http-status");
  assert.equal(smokeCalls, 14);
});
test("old healthy deployment cannot pass and polling ends at deadline", async () => {
  let time = 0;
  const report = await verifyDeployment("https://web.example", "https://api.example", revision, {
    now: () => time, pause: async ms => { time += ms; }, intervalMs: 10, deadlineMs: 25,
    request: async url => { assert.ok(url.includes("release")); return Response.json({ revision: "b".repeat(40) }); },
  });
  assert.equal(report.ok, false); assert.equal(time, 25); assert.equal(report.attempts.length, 3);
});
test("release headers and body reads have bounded timeouts and redact provider failures", async () => {
  const report = await verifyDeployment("https://web.example", "https://api.example", revision, {
    deadlineMs: 35, intervalMs: 1, requestTimeoutMs: 10,
    request: async url => url.includes("web.example") ? new Promise(() => {})
      : { status: 200, json: () => new Promise(() => {}) },
  });
  assert.equal(report.ok, false); assert.ok(report.attempts.length > 0);
  assert.ok(report.attempts.every(attempt => !attempt.webReady && !attempt.apiReady));
});
test("invalid origins or revision reject before issuing requests", async () => {
  for (const args of [["http://web.example", "https://api.example", revision], ["https://private@web.example", "https://api.example", revision], ["https://web.example", "https://api.example", "main"]]) {
    await assert.rejects(verifyDeployment(...args, { request: () => { assert.fail("must not request"); } }));
  }
});
