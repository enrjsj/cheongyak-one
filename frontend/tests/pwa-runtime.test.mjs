import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
function worker({ fetch, match = async () => undefined, put = async () => {}, keys = async () => [], remove = async () => true } = {}) {
  const handlers = {}; let skipped = false;
  vm.runInNewContext(source, {
    Response, fetch,
    caches: { match, open: async () => ({ put }), keys, delete: remove },
    self: { location: { origin: "https://web.example" }, addEventListener: (name, fn) => { handlers[name] = fn; },
      skipWaiting: async () => { skipped = true; }, clients: { claim: async () => {} } }, URL,
  });
  return { handlers, skipped: () => skipped };
}
async function dispatch(instance, request) {
  let response; const waits = [];
  instance.handlers.fetch({ request, respondWith: value => { response = value; }, waitUntil: value => waits.push(value) });
  const result = await response;
  await Promise.all(waits);
  return result;
}
const asset = { url: "https://web.example/app.js", method: "GET", mode: "cors", destination: "script" };
test("cached asset survives background network failure without an unhandled rejection", async () => {
  const instance = worker({ fetch: async () => { throw new Error("offline"); }, match: async () => new Response("cached") });
  assert.equal(await (await dispatch(instance, asset)).text(), "cached");
});
test("cache write/read failures do not discard a valid network asset", async () => {
  const instance = worker({ fetch: async () => new Response("network"), match: async () => { throw new Error("blocked"); }, put: async () => { throw new Error("quota"); } });
  assert.equal(await (await dispatch(instance, asset)).text(), "network");
});
test("missing cache and network produce a handled failed asset response", async () => {
  const instance = worker({ fetch: async () => { throw new Error("offline"); } });
  assert.equal((await dispatch(instance, asset)).type, "error");
});
test("offline navigation uses fallback even when offline cache is unavailable", async () => {
  const instance = worker({ fetch: async () => { throw new Error("offline"); }, match: async () => { throw new Error("blocked"); } });
  const result = await dispatch(instance, { ...asset, mode: "navigate" });
  assert.equal(result.status, 503); assert.match(await result.text(), /인터넷 연결/);
});
test("API, cross-origin and non-GET requests bypass the worker", async () => {
  const instance = worker({ fetch: () => { throw new Error("must not fetch"); } });
  for (const request of [{ ...asset, url: "https://web.example/api/v1/notices" }, { ...asset, url: "https://api.example/app.js" }, { ...asset, method: "POST" }])
    assert.equal(await dispatch(instance, request), undefined);
});
test("failed install never activates an incomplete shell", async () => {
  const instance = worker({ fetch: async () => new Response("unavailable", { status: 503 }) });
  let pending; instance.handlers.install({ waitUntil: value => { pending = value; } });
  await assert.rejects(pending); assert.equal(instance.skipped(), false);
});
test("successful install activates and cleanup preserves unrelated and current caches", async () => {
  const removed = [];
  const instance = worker({ fetch: async () => new Response("asset"),
    keys: async () => ["other-app", "cheongyak-one-shell-v1", "cheongyak-one-shell-v2"],
    remove: async key => { removed.push(key); } });
  let pending; instance.handlers.install({ waitUntil: value => { pending = value; } }); await pending;
  assert.equal(instance.skipped(), true);
  instance.handlers.activate({ waitUntil: value => { pending = value; } }); await pending;
  assert.deepEqual(removed, ["cheongyak-one-shell-v1"]);
});
