import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HEALTH_URL, keepApiAwake, remainingWindowMs } from "../../scripts/keep-api-awake.mjs";

const at = time => Date.parse(`2026-10-29T${time}+09:00`);
const up = () => Response.json({ status: "UP" });

test("KST window includes morning prewarm and stops exactly at 18:00 across UTC dates", () => {
  for (const time of ["00:00:00", "08:49:59", "18:00:00", "23:59:59"]) assert.equal(remainingWindowMs(at(time)), 0);
  for (const time of ["08:50:00", "09:00:00", "17:59:59"]) assert.ok(remainingWindowMs(at(time)) > 0);
  assert.equal(remainingWindowMs(at("17:59:59")), 1000);
  // Sunday uses the same window.
  assert.ok(remainingWindowMs(Date.parse("2026-11-01T09:00:00+09:00")) > 0);
});

test("late scheduled/manual runs make no network call outside the window", async () => {
  for (const time of ["08:49:59", "18:00:00", "23:00:00"]) {
    const report = await keepApiAwake({ now: () => at(time), request: () => assert.fail("night request") });
    assert.equal(report.skipped, true); assert.deepEqual(report.attempts, []);
  }
});

test("cold start retries before success, only calls the fixed public GET without credentials", async () => {
  let time = at("08:53:00"); let calls = 0;
  const report = await keepApiAwake({ now: () => time, pause: async ms => { time += ms; },
    request: async (url, options) => {
      assert.equal(url, HEALTH_URL); assert.equal(options.method, "GET");
      assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store"); assert.ok(options.signal);
      calls++;
      if (calls === 1) throw new Error("private provider detail");
      if (time < at("08:56:10")) return new Response("unavailable", { status: 503 });
      return up();
    },
  });
  assert.equal(report.ok, true); assert.equal(calls, 20);
  assert.equal(JSON.stringify(report).includes("private provider detail"), false);
});

test("HTML and health DOWN cannot count as success; healthy response ends retries", async () => {
  let time = at("12:00:00"); const replies = [new Response("<html>Starting</html>"), Response.json({ status: "DOWN" }), up()];
  const report = await keepApiAwake({ now: () => time, pause: async ms => { time += ms; }, request: async () => replies.shift() });
  assert.equal(report.ok, true); assert.equal(report.attempts.length, 3);
  assert.equal(report.attempts[0].reason, "request-or-json-error");
  assert.equal(report.attempts[1].reason, "health-not-up");
});

test("persistent failure has a four-minute bound, and retries never cross 18:00", async () => {
  for (const [start, duration, calls] of [["10:00:00", 240_000, 24], ["17:59:45", 15_000, 2]]) {
    let time = at(start);
    const report = await keepApiAwake({ now: () => time, pause: async ms => { time += ms; }, request: async () => {
      assert.ok(remainingWindowMs(time) > 0); return new Response("", { status: 503 });
    } });
    assert.equal(report.ok, false); assert.equal(report.attempts.length, calls); assert.equal(time - at(start), duration);
  }
});

test("hung headers and response body are aborted within the overall budget", async () => {
  for (const bodyHang of [false, true]) {
    const start = Date.now(); let aborted = false;
    const report = await keepApiAwake({ now: () => at("12:00:00") + Date.now() - start,
      deadlineMs: 40, requestTimeoutMs: 10, intervalMs: 1,
      request: async (_url, options) => {
        options.signal.addEventListener("abort", () => { aborted = true; });
        return bodyHang ? { status: 200, json: () => new Promise(() => {}) } : new Promise(() => {});
      },
    });
    assert.equal(report.ok, false); assert.ok(aborted); assert.ok(report.attempts.length > 0);
  }
});

test("invalid timing cannot create unbounded polling", async () => {
  for (const options of [{ deadlineMs: 0 }, { deadlineMs: 240_001 }, { requestTimeoutMs: Infinity }, { intervalMs: -1 }]) {
    await assert.rejects(keepApiAwake({ ...options, request: () => assert.fail("invalid request") }));
  }
});

test("an in-flight request is aborted at closing time instead of using the full request timeout", async () => {
  const start = Date.now(); let calls = 0; let aborted = false;
  const closing = at("18:00:00");
  const report = await keepApiAwake({ now: () => closing - 30 + Date.now() - start,
    request: async (_url, options) => {
      calls++; options.signal.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {});
    },
  });
  assert.equal(calls, 1); assert.ok(aborted); assert.equal(report.ok, false);
  assert.equal(report.attempts[0].reason, "timeout");
});

test("workflow cron covers every day prewarm and five-minute daytime slots in UTC", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/keep-api-awake.yml", import.meta.url), "utf8");
  const expressions = [...workflow.matchAll(/cron: "([^"]+)"/g)].map(match => match[1]);
  const expand = field => field.split(",").flatMap(part => {
    const [range, step = "1"] = part.split("/");
    const [start, end = start] = range.split("-").map(Number);
    return Array.from({ length: Math.floor((end - start) / Number(step)) + 1 }, (_, i) => start + i * Number(step));
  });
  const slots = expressions.flatMap(expression => {
    const [minute, hour, ...days] = expression.split(" ");
    assert.deepEqual(days, ["*", "*", "*"]);
    return expand(hour).flatMap(h => expand(minute).map(m => ((h + 9) % 24) * 60 + m));
  }).sort((a, b) => a - b);
  assert.equal(slots.length, 110); assert.equal(slots.at(-1), 17 * 60 + 58);
  assert.equal(slots[0], 8 * 60 + 53);
  assert.ok(slots.every((slot, i) => !i || slot - slots[i - 1] === 5));
  assert.match(workflow, /if: github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /run: node scripts\/keep-api-awake.mjs/);
});
