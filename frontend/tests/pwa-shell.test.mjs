import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readPublicFile = (name) => readFile(new URL(`../public/${name}`, import.meta.url), "utf8");

test("PWA manifest declares an installable maskable icon", async () => {
  const manifest = JSON.parse(await readPublicFile("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.match(manifest.icons[0].purpose, /maskable/);
});

test("service worker excludes API responses and falls back offline for navigations", async () => {
  const worker = await readPublicFile("sw.js");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /caches\.match\("\/offline\.html"\)/);
  assert.match(worker, /self\.skipWaiting\(\)/);
});
