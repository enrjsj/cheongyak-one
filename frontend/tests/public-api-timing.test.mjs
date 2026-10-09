import test from "node:test";
import assert from "node:assert/strict";
import { measurePublicApi, runMeasureCli } from "../../scripts/measure-public-api.mjs";

test("timing probe separates first health from sequential list and facet samples", async () => {
  const calls = [];
  let clock = 0;
  const report = await measurePublicApi("https://api.example.test", async (url, options) => {
    calls.push(new URL(url).pathname);
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    clock += calls.length === 1 ? 1000 : 20;
    const body = url.includes("health") ? { status: "UP" } : url.includes("facets")
      ? { total: 1, endingToday: 0, open: 1, upcoming: 0 } : { content: [], totalElements: 0 };
    return new Response(JSON.stringify(body));
  }, { now: () => clock });
  assert.equal(report.ok, true);
  assert.deepEqual(report.results.map(x => x.name), ["initial-health", "list-1", "facets-1", "list-2", "facets-2"]);
  assert.deepEqual(report.results.map(x => x.durationMs), [1000, 20, 20, 20, 20]);
  assert.equal(calls.length, 5);
});

test("unhealthy or timed out initial response does not launch list queries", async () => {
  let calls = 0;
  const report = await measurePublicApi("https://api.example.test", async () => { calls++; return new Response("unavailable", { status: 503 }); });
  assert.equal(report.ok, false);
  assert.equal(calls, 1);
  const timeout = await measurePublicApi("https://api.example.test", () => new Promise(() => {}), { timeoutMs: 5 });
  assert.equal(timeout.results[0].reason, "timeout");
  assert.equal(timeout.results.length, 1);
});

test("malformed payloads and unsafe origins are not reported as successful timing", async () => {
  const invalid = await measurePublicApi("https://api.example.test", async () => new Response("{}"));
  assert.equal(invalid.results[0].reason, "invalid-body");
  let calls = 0;
  for (const url of ["https://user:secret@example.test", "https://example.test/path", "https://example.test?key=secret"]) {
    await assert.rejects(() => measurePublicApi(url, async () => { calls++; }));
  }
  assert.equal(calls, 0);
  const output = [];
  assert.equal(await runMeasureCli(["https://user:secret@example.test"], { error: x => output.push(x) }), 1);
  assert.ok(output.every(x => !x.includes("secret")));
});
