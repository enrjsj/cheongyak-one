import test from "node:test";
import assert from "node:assert/strict";
import { smokeDeployment, runSmokeCli } from "../../scripts/smoke-deployment.mjs";

test("deployment smoke uses only credential-free reads and verifies auth boundaries", async () => {
  const results = await smokeDeployment("https://web.example", "https://api.example", async (url, init) => {
    assert.equal(init.method, "GET");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    assert.ok(init.signal);
    if (url.includes("/admin/") || url.includes("/members/")) return new Response("{}", { status: 401, headers: { "cache-control": "no-store" } });
    if (url.endsWith("/health")) return Response.json({ status: "UP" });
    if (url.endsWith("/freshness")) return Response.json({ generatedAt: "2026-10-04T00:00:00Z" });
    return new Response('<div id="root"></div>', { headers: { "content-type": "text/html" } });
  });
  assert.equal(results.length, 7);
  assert.ok(results.every(result => result.ok));
  assert.ok(results.every(result => Number.isInteger(result.durationMs) && result.durationMs >= 0 && !result.reason));
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

test("smoke distinguishes HTTP status from invalid JSON without logging payloads", async () => {
  const results = await smokeDeployment("https://web.example", "https://api.example", async url => {
    if (url.endsWith("/health")) return new Response("private invalid JSON", { status: 200 });
    return new Response("private server error", { status: 503 });
  });
  assert.equal(results.find(result => result.name === "health").reason, "invalid-body");
  assert.ok(results.filter(result => result.name !== "health").every(result => result.reason === "http-status" && result.status === 503));
  assert.ok(!JSON.stringify(results).includes("private"));
});

test("smoke reports network failures without exposing exception details", async () => {
  const results = await smokeDeployment("https://web.example", "https://api.example", async () => { throw new Error("secret connection details"); });
  assert.ok(results.every(result => result.reason === "network" && !result.ok && result.status === undefined));
  assert.ok(!JSON.stringify(results).includes("secret"));
});

test("smoke bounds stalled headers and aborts all requests without retries", async () => {
  const signals = [];
  const results = await smokeDeployment("https://web.example", "https://api.example", async (_, init) => {
    signals.push(init.signal); return new Promise(() => {});
  }, { timeoutMs: 20 });
  assert.equal(signals.length, 7);
  assert.ok(signals.every(signal => signal.aborted));
  assert.ok(results.every(result => result.reason === "timeout" && !result.ok));
});

test("smoke deadline includes body reads and retains received HTTP status", async () => {
  const results = await smokeDeployment("https://web.example", "https://api.example", async url => ({
    status: url.includes("/admin/") || url.includes("/members/") ? 401 : 200,
    text: () => new Promise(() => {}),
  }), { timeoutMs: 20 });
  assert.ok(results.every(result => result.reason === "timeout" && Number.isInteger(result.status)));
});

test("smoke classifies a broken body connection separately from invalid payloads", async () => {
  const results = await smokeDeployment("https://web.example", "https://api.example", async () => ({
    status: 200, text: async () => { throw new Error("socket closed"); },
  }));
  assert.equal(results.find(result => result.name === "health").reason, "network");
  assert.equal(results.find(result => result.name === "health").status, 200);
});

test("smoke validates timeout before issuing requests", async () => {
  for (const timeoutMs of [0, -1, 1.5, NaN, Infinity, 60001, "20"]) {
    let called = false;
    await assert.rejects(smokeDeployment("https://web.example", "https://api.example", async () => { called = true; }, { timeoutMs }));
    assert.equal(called, false);
  }
});

async function successfulRequest(url) {
  if (url.includes("/admin/") || url.includes("/members/")) return new Response("{}", { status: 401, headers: { "cache-control": "no-store" } });
  if (url.endsWith("/health")) return Response.json({ status: "UP" });
  if (url.endsWith("/freshness")) return Response.json({ generatedAt: "2026-10-05T00:00:00Z" });
  return new Response('<div id="root"></div>', { headers: { "content-type": "text/html" } });
}

test("JSON CLI returns one versioned report with UTC times and successful exit", async () => {
  const output = []; const errors = [];
  const code = await runSmokeCli(["https://web.example", "https://api.example", "--json", "--timeout-ms", "1000"], {
    request: successfulRequest, log: line => output.push(line), error: line => errors.push(line),
  });
  assert.equal(code, 0); assert.deepEqual(errors, []); assert.equal(output.length, 1);
  const report = JSON.parse(output[0]);
  assert.equal(report.schemaVersion, 1); assert.equal(report.ok, true); assert.equal(report.timeoutMs, 1000);
  assert.deepEqual(report.summary, { passed: 7, failed: 0 });
  assert.equal(report.results.length, 7);
  assert.match(report.startedAt, /Z$/); assert.ok(Date.parse(report.completedAt) >= Date.parse(report.startedAt));
});

test("JSON CLI preserves successful checks when another check times out", async () => {
  const output = [];
  const code = await runSmokeCli(["https://web.example", "https://api.example", "--timeout-ms", "30", "--json"], {
    request: url => url.endsWith("/health") ? new Promise(() => {}) : successfulRequest(url), log: line => output.push(line),
  });
  assert.equal(code, 1);
  const report = JSON.parse(output[0]);
  assert.equal(report.ok, false); assert.deepEqual(report.summary, { passed: 6, failed: 1 });
  assert.equal(report.results.find(result => result.name === "health").reason, "timeout");
});

test("CLI rejects invalid and duplicate options before any request without echoing secrets", async () => {
  for (const args of [[], ["https://secret@web.example", "https://api.example"],
    ...[["--unknown-secret"], ["--json", "--json"], ["--timeout-ms"], ["--timeout-ms", "0"],
      ["--timeout-ms", "1.5"], ["--timeout-ms", "60001"], ["--timeout-ms", "10", "--timeout-ms", "20"]]
      .map(flags => ["https://web.example", "https://api.example", ...flags])]) {
    let called = false; const errors = []; const output = [];
    const code = await runSmokeCli(args, { request: async () => { called = true; }, log: line => output.push(line), error: line => errors.push(line) });
    assert.equal(code, 1); assert.equal(called, false); assert.deepEqual(output, []);
    assert.equal(errors.length, 1); assert.ok(!errors[0].includes("secret"));
  }
});

test("plain CLI keeps per-check output and summary; help never requests the network", async () => {
  const output = [];
  assert.equal(await runSmokeCli(["https://web.example", "https://api.example"], { request: successfulRequest, log: line => output.push(line) }), 0);
  assert.equal(output.length, 9); assert.match(output[1], /frontend: PASS \(200\)/); assert.equal(output.at(-1), "Summary: 7 passed, 0 failed");
  let called = false;
  assert.equal(await runSmokeCli(["--help"], { request: async () => { called = true; }, log: () => {} }), 0);
  assert.equal(called, false);
});
