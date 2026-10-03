import assert from "node:assert/strict";
import test from "node:test";
import { cacheNoticePage, readCachedNoticePage, noticePageCacheKey, noticePageStorage, NOTICE_PAGE_CACHE_MAX_ENTRIES, NOTICE_PAGE_CACHE_MAX_AGE_MS } from "../src/noticePageCache.ts";

const page = { content: [], number: 0, size: 12, totalElements: 0, totalPages: 0 };
const key = (id) => noticePageCacheKey({ page: id });
function storageMock() {
  const values = new Map();
  return {
    values,
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("a single write removes consecutive invalid and expired entries, preserving unrelated storage", () => {
  const storage = storageMock();
  storage.setItem(key(1), "broken");
  storage.setItem(key(2), JSON.stringify({ cachedAt: 0, page }));
  storage.setItem(key(3), "null");
  storage.setItem("preferences", "keep");
  cacheNoticePage(storage, key(4), page, NOTICE_PAGE_CACHE_MAX_AGE_MS + 1);
  assert.deepEqual([...storage.values.keys()].sort(), ["preferences", key(4)].sort());
});

test("refreshing an existing entry at capacity preserves all other fresh entries", () => {
  const storage = storageMock();
  for (let id = 0; id < NOTICE_PAGE_CACHE_MAX_ENTRIES; id += 1) cacheNoticePage(storage, key(id), page, 100 + id);
  cacheNoticePage(storage, key(10), page, 200);
  assert.equal(storage.length, NOTICE_PAGE_CACHE_MAX_ENTRIES);
  assert.ok(readCachedNoticePage(storage, key(0), 200));
  assert.equal(readCachedNoticePage(storage, key(10), 200).cachedAt, 200);
  cacheNoticePage(storage, key(99), page, 201);
  assert.equal(storage.length, NOTICE_PAGE_CACHE_MAX_ENTRIES);
  assert.equal(storage.getItem(key(0)), null);
  assert.ok(readCachedNoticePage(storage, key(10), 201));
});

test("cache expiry accepts the boundary and rejects future or non-finite timestamps", () => {
  const storage = storageMock();
  storage.setItem(key(1), JSON.stringify({ cachedAt: 100, page }));
  assert.ok(readCachedNoticePage(storage, key(1), 100 + NOTICE_PAGE_CACHE_MAX_AGE_MS));
  assert.equal(readCachedNoticePage(storage, key(1), 101 + NOTICE_PAGE_CACHE_MAX_AGE_MS), undefined);
  storage.setItem(key(2), JSON.stringify({ cachedAt: 200, page }));
  assert.equal(readCachedNoticePage(storage, key(2), 100), undefined);
  storage.setItem(key(3), '{"cachedAt":1e400,"page":' + JSON.stringify(page) + '}');
  assert.equal(readCachedNoticePage(storage, key(3), 100), undefined);
});

test("blocked storage and quota errors do not escape into the notice flow", () => {
  const fail = () => { throw new Error("storage unavailable"); };
  assert.equal(readCachedNoticePage({ getItem: fail, removeItem: fail }, key(1)), undefined);
  assert.doesNotThrow(() => cacheNoticePage({ ...storageMock(), setItem: fail }, key(1), page));
});

test("equivalent search conditions share a cache despite property insertion order", () => {
  const storage = storageMock();
  const first = noticePageCacheKey({ keyword: "서울", page: 0, category: "APARTMENT" });
  const second = noticePageCacheKey({ category: "APARTMENT", page: 0, keyword: "서울", region: undefined });
  cacheNoticePage(storage, first, page, 100);
  assert.deepEqual(readCachedNoticePage(storage, second, 101)?.page, page);
  assert.notEqual(first, noticePageCacheKey({ keyword: "부산", page: 0, category: "APARTMENT" }));
});

test("denied sessionStorage access disables cache without interrupting searches", () => {
  const denied = { get sessionStorage() { throw new DOMException("Denied", "SecurityError"); } };
  const storage = noticePageStorage(denied);
  assert.equal(storage, undefined);
  assert.equal(readCachedNoticePage(storage, key(1)), undefined);
  assert.doesNotThrow(() => cacheNoticePage(storage, key(1), page));
  const available = storageMock();
  assert.equal(noticePageStorage({ sessionStorage: available }), available);
});

test("malformed notice rows and pagination are rejected and removed before rendering", () => {
  const storage = storageMock();
  const invalidPages = [
    { ...page, content: [null] },
    { ...page, content: [{ id: 1, title: "incomplete" }] },
    { ...page, number: -1 },
    { ...page, size: 0 },
    { ...page, totalElements: 1.5 },
    { ...page, totalPages: -1 },
  ];
  for (const invalid of invalidPages) {
    storage.setItem(key(1), JSON.stringify({ cachedAt: 100, page: invalid }));
    assert.equal(readCachedNoticePage(storage, key(1), 101), undefined);
    assert.equal(storage.getItem(key(1)), null);
  }
});
