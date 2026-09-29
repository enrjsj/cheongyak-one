imartial<PageResponse<NoticeSummary>;ort type { NoticeSummary, PageResponse } from "./api";

/**
 * Render Free 인스턴스가 다시 기동되는 동안에도 같은 탭에서 이미 본 목록을 즉시 보여주기 위한
  * 짧은 수명의 세션 캐시다. 로그인 정보나 상세 공고, 서버 오류 정보는 저장하지 않는다.
   */
   export const NOTICE_PAGE_CACHE_PREFIX = "cheongyak-one-notice-page:v2:";
   export const NOTICE_PAGE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
   export const NOTICE_PAGE_CACHE_MAX_ENTRIES = 16;

   type StorageReader = Pick<Storage, "getItem"> & Partial<Pick<Storage, "removeItem">>;
   type StorageWriter = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

   interface CachedNoticePage {
     cachedAt: number;
       page: PageResponse<NoticeSummary>;
       }

       export function noticePageCacheKey(request: Record<string, unknown>): string {
         return NOTICE_PAGE_CACHE_PREFIX + JSON.stringify(request);
         }

         function isPage(value: unknown): value is PageResponse<NoticeSummary> {
           if (!value || typeof value !== "object") return false;
             const page = value as Partial<PageResponse<NoticeSummary>>;
               return Array.isArray(page.content)
                   && typeof page.number === "number"
                       && typeof page.size === "number"
                           && typeof page.totalElements === "number"
                               && typeof page.totalPages === "number";
                               }

                               function removeCachedEntry(storage: StorageReader, key: string): void {
                                 try { storage.removeItem?.(key); } catch { }
                                 }

                                 export function readCachedNoticePage(storage: StorageReader, key: string, now = Date.now(), maxAgeMs = NOTICE_PAGE_CACHE_MAX_AGE_MS): CachedNoticePage | undefined {
                                   try {
                                       const raw = storage.getItem(key);
                                           if (!raw) return undefined;
                                               const parsed: unknown = JSON.parse(raw);
                                                   if (!parsed || typeof parsed !== "object") { removeCachedEntry(storage, key); return undefined; }
                                                       const entry = parsed as Partial<CachedNoticePage>;
                                                           if (typeof entry.cachedAt !== "number" || now - entry.cachedAt < 0 || now - entry.cachedAt > maxAgeMs || !isPage(entry.page)) { removeCachedEntry(storage, key); return undefined; }
                                                               return { cachedAt: entry.cachedAt, page: entry.page };
                                                                 } catch { removeCachedEntry(storage, key); return undefined; }
                                                                 }

                                                                 function pruneCachedNoticePages(storage: StorageWriter, now: number): void {
                                                                    const freshEntries: Array<{ key: string; cachedAt: number }> = [];
                                                                      for (let index = 0; index < storage.length; index += 1) {
                                                                            const key = storage.key(index);
                                                                                if (!key?.startsWith(NOTICE_PAGE_CACHE_PREFIX)) continue;
                                                                                    const cached = readCachedNoticePage(storage, key, now);
                                                                                        if (cached) freshEntries.push({ key, cachedAt: cached.cachedAt });
                                                                                          }
                                                                                            freshEntries.sort((left, right) => left.cachedAt - right.cachedAt).slice(0, Math.max(0, freshEntries.length - NOTICE_PAGE_CACHE_MAX_ENTRIES + 1)).forEach(({ key }) => removeCachedEntry(storage, key));
                                                                                            }

                                                                                            export function cacheNoticePage(storage: StorageWriter, key: string, page: PageResponse<NoticeSummary>, cachedAt = Date.now()): void {
                                                                                                try { pruneCachedNoticePages(storage, cachedAt); storage.setItem(key, JSON.stringify({ cachedAt, page } satisfies CachedNoticePage)); } catch { }
                                                                                                }

                                                                                            }
                                                                      }
                                                                 }