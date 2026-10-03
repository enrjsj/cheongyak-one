import type { NoticeSummary, PageResponse } from "./api";
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
  return NOTICE_PAGE_CACHE_PREFIX + JSON.stringify(
    Object.fromEntries(Object.entries(request).sort(([left], [right]) => left.localeCompare(right))),
  );
}
export function noticePageStorage(source: { readonly sessionStorage: Storage }): Storage | undefined {
  try {
    return source.sessionStorage;
  } catch {
    return undefined;
  }
}
function isNotice(value: unknown): value is NoticeSummary {
  if (!value || typeof value !== "object") return false;
  const notice = value as Partial<NoticeSummary>;
  return Number.isSafeInteger(notice.id) && notice.id! > 0
    && typeof notice.title === "string"
    && typeof notice.sourceSystem === "string"
    && typeof notice.housingCategory === "string"
    && typeof notice.status === "string"
    && typeof notice.syncedAt === "string";
}
function isPage(value: unknown): value is PageResponse<NoticeSummary> {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<PageResponse<NoticeSummary>>;
  return Array.isArray(page.content)
    && page.content.every(isNotice)
    && Number.isSafeInteger(page.number) && page.number! >= 0
    && Number.isSafeInteger(page.size) && page.size! > 0
    && Number.isSafeInteger(page.totalElements) && page.totalElements! >= 0
    && Number.isSafeInteger(page.totalPages) && page.totalPages! >= 0;
}
function removeCachedEntry(storage: StorageReader, key: string): void {
  try {
    storage.removeItem?.(key);
  } catch {
    // 브라우저 저장소가 차단돼도 공고 목록 조회는 계속해야 한다.
  }
}
export function readCachedNoticePage(
  storage: StorageReader | undefined,
  key: string,
  now = Date.now(),
  maxAgeMs = NOTICE_PAGE_CACHE_MAX_AGE_MS,
): CachedNoticePage | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      removeCachedEntry(storage, key);
      return undefined;
    }
    const entry = parsed as Partial<CachedNoticePage>;
    if (typeof entry.cachedAt !== "number" || now - entry.cachedAt < 0 || now - entry.cachedAt > maxAgeMs || !isPage(entry.page)) {
      removeCachedEntry(storage, key);
      return undefined;
    }
    return { cachedAt: entry.cachedAt, page: entry.page };
  } catch {
    // 저장 공간이 차단되었거나 오래된 형식이면 네트워크 요청만 사용한다.
    removeCachedEntry(storage, key);
    return undefined;
  }
}
function pruneCachedNoticePages(storage: StorageWriter, now: number, incomingKey: string): void {
  const freshEntries: Array<{ key: string; cachedAt: number }> = [];
  const keys: string[] = [];
  // Collect keys before reads can remove entries and shift storage indexes.
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(NOTICE_PAGE_CACHE_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    const cached = readCachedNoticePage(storage, key, now);
    // Reserve one slot for the incoming value, including an existing key refresh.
    if (cached && key !== incomingKey) freshEntries.push({ key, cachedAt: cached.cachedAt });
  }
  freshEntries
    .sort((left, right) => left.cachedAt - right.cachedAt)
    .slice(0, Math.max(0, freshEntries.length - NOTICE_PAGE_CACHE_MAX_ENTRIES + 1))
    .forEach(({ key }) => removeCachedEntry(storage, key));
}
export function cacheNoticePage(storage: StorageWriter | undefined, key: string, page: PageResponse<NoticeSummary>, cachedAt = Date.now()): void {
  if (!storage) return;
  try {
    pruneCachedNoticePages(storage, cachedAt, key);
    storage.setItem(key, JSON.stringify({ cachedAt, page } satisfies CachedNoticePage));
  } catch {
    // private mode·용량 초과에서도 공고 조회 자체는 계속 동작해야 한다.
  }
}

