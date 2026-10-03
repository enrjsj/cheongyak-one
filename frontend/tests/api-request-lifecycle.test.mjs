import assert from "node:assert/strict";
import test from "node:test";
import { fetchNoticePage, requestAiConsultation, ApiRequestTimeoutError } from "../src/api.ts";

for (const status of [200, 503]) {
  test(`timeout remains active while reading a ${status} response body`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let bodyStarted;
    const ready = new Promise((resolve) => { bodyStarted = resolve; });
    t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
      const read = () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        bodyStarted();
      });
      return { ok: status === 200, status, headers: new Headers(), text: read, json: read };
    });
    const result = assert.rejects(fetchNoticePage({}), ApiRequestTimeoutError);
    await ready;
    t.mock.timers.tick(12_000);
    await result;
  });
}

test("caller cancellation still aborts the body after response headers arrive", async (t) => {
  const controller = new AbortController();
  let bodyStarted;
  const ready = new Promise((resolve) => { bodyStarted = resolve; });
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => ({
    ok: true, status: 200, headers: new Headers(),
    text: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      bodyStarted();
    }),
  }));
  const result = assert.rejects(fetchNoticePage({}, controller.signal), { name: "AbortError" });
  await ready;
  controller.abort();
  await result;
});

test("AI consultation uses an isolated 75 second deadline and sends only approved fields", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let aborted = false;
  t.mock.method(globalThis, "fetch", async (_url, { signal, body, credentials, method }) => {
    assert.deepEqual(JSON.parse(body), { noticeId: 1, topic: "CASH", consent: true });
    assert.equal(credentials, "include");
    assert.equal(method, "POST");
    return { ok: true, status: 200, headers: new Headers(), text: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); });
      started();
    }) };
  });
  const result = assert.rejects(requestAiConsultation(1, "CASH", true), ApiRequestTimeoutError);
  await ready;
  t.mock.timers.tick(12_000);
  assert.equal(aborted, false);
  t.mock.timers.tick(63_000);
  await result;
});
