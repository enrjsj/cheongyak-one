import test from "node:test";
import assert from "node:assert/strict";
import { smokeDeployment } from "../../scripts/smoke-deployment.mjs";

test("deployment smoke uses only credential-free reads and verifies auth boundaries", async () => {
  const results = await smokeDeployment("https://web.example", "https://api.example", async (url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    assert.ok(init.signal);
    if (url.includes("/admin/") || url.includes("/members/")) return new Response("{}", { status: 401 });
    if (url.endsWith("/health")) return Response.json({ status: "UP" });
    if (url.endsWith("/freshness")) return Response.json({ generatedAt: "2026-10-04T00:00:00Z" });
    return new Response('<div id="root"></div>', { headers: { "content-type": "text/html" } });
  });
  assert.equal(results.length, 5);
  assert.ok(results.every(result => result.ok));
});
test("smoke rejects broken payloads and accidentally public admin routes", async () => {
  const results = await smokeDeployment("https://web.example", "https://api.example", async () => new Response("{}", { status: 200 }));
  assert.ok(results.every(result => !result.ok));
});
test("smoke validates both origins before any network request", async () => {
  let called = false;
  await assert.rejects(smokeDeployment("https://web.example", "https://secret@api.example", async () => { called = true; }));
  assert.equal(called, false);
});
