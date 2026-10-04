// 공고 API 응답은 절대 캐시하지 않고, 설치형 화면을 여는 데 필요한 정적 파일만 보관한다.
const CACHE_NAME = "cheongyak-one-shell-v2";
const APP_SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/brand/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(APP_SHELL.map((path) => fetch(path, { cache: "reload" }).then((response) => {
        if (!response.ok) throw new Error("App shell unavailable");
        return cache.put(path, response);
      }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("cheongyak-one-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match("/offline.html").catch(() => undefined);
      return cached || new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>연결 확인</title><h1>인터넷 연결을 확인해주세요</h1><p>연결 후 페이지를 새로고침해주세요.</p></html>', { status: 503, headers: { "content-type": "text/html;charset=utf-8" } });
    }));
    return;
  }

  if (["script", "style", "image", "font"].includes(request.destination)) {
    const cached = caches.match(request).catch(() => undefined);
    const network = fetch(request).then(async response => {
      if (response.ok) {
        // Cache quota/security failures must not discard a usable network response.
        await caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())).catch(() => {});
      }
      return response;
    }).catch(() => undefined);
    // Keep background updates alive and handle rejection even when a cached response wins.
    event.waitUntil(network.then(() => {}));
    event.respondWith(cached.then(async response => response || await network || Response.error()));
  }
});
