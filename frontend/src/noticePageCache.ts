import type { NoticeSummary, PageResponse } from "./api";

/**
 * Render Free 인스턴스가 다시 기동되는 동안에도 같은 탭에서 이미 본 목록을 즉시 보여주기 위한
 * 짧은 수명의 세션 캐시다. 로그인 정보나 상세 공고, 서버 오류 정보는 저장하지 않는다.
 */
export const NOTICE_PAGE_CACHE_PREFIX = "cheongyak-one-notice-page:";
export const NOTICE_PAGE_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

interface CachedNoticePage {
  cachedAt: number;
  page: PageResponse<NoticeSummary>;
}

export function noticePageCacheKey(request: Record<string, unknown>): string {
  return `${NOTICE_PAGE_CACHE_PREFIX}${JSON.stringify(request)}`;
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

export function readCachedNoticePage(
  storage: StorageReader,
  key: string,
  now = Date.now(),
  maxAgeMs = NOTICE_PAGE_CACHE_MAX_AGE_MS,
): CachedNoticePage | undefined {
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    const entry = parsed as Partial<CachedNoticePage>;
    if (typeof entry.cachedAt !== "number" || now - entry.cachedAt < 0 || now - entry.cachedAt > maxAgeMs || !isPage(entry.page)) return undefined;
    return { cachedAt: entry.cachedAt, page: entry.page };
  } catch {
    // 저장 공간이 차단되었거나 오래된 형식이면 네트워크 요청만 사용한다.
    return undefined;
  }
}

export function cacheNoticePage(storage: StorageWriter, key: string, page: PageResponse<NoticeSummary>, cachedAt = Date.now()): void {
  try {
    storage.setItem(key, JSON.stringify({ cachedAt, page } satisfies CachedNoticePage));
  } catch {
    // private mode·용량 초과에서도 공고 조회 자체는 계속 동작해야 한다.
  }
}
