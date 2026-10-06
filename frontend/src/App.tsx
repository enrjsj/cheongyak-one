import { Icon, type IconName } from "./Icon";
import NoticeDetailDialog from "./NoticeDetailDialog";
import { StatusKey, Application, CATEGORY_LABELS, koreaToday, dateValue, daysBetween, formatShortDate, formatChangedAt, weekday, toApplication } from "./noticePresentation";
import { FavoriteProgressFilter, FavoriteChecklistKey, FavoriteSortKey, FAVORITE_PROGRESS_LABELS, FAVORITE_PROGRESS_PRIORITY, FAVORITE_APPLICATION_RESULT_LABELS, FAVORITE_APPLICATION_RESULT_PRIORITY, FAVORITE_CHECKLIST_ITEMS, completedChecklistCount, incompleteChecklistLabels, applicationResultFromFilter, resultDueLabel } from "./favoritePresentation";
import { SourceFreshnessPanel } from "./SourceFreshnessPanel";
// 서비스의 주요 사용자 흐름(검색·관심청약·비교·회원·사전점검)을 조합하는 화면 컨테이너다.
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  changeMemberPassword,
  ApiError,
  ApiRequestTimeoutError,
  clearComparisons,
  confirmEmailVerification,
  deleteSearchPreference,
  deleteEligibilityProfile,
  fetchNoticeFacets,
  fetchNoticeFreshness,
  fetchNoticePage,
  fetchCurrentMember,
  fetchComparisonIds,
  fetchFavoriteIds,
  fetchFavoriteTrackers,
  fetchMemberSessions,
  fetchNotice,
  fetchNoticeChanges,
  fetchNotificationInbox,
  fetchSearchPreference,
  fetchSavedSearchProfiles,
  fetchPolicyConsents,
  fetchEligibilityProfile,
  HousingCategory,
  SupplyType,
  FavoriteProgress,
  FavoriteApplicationResult,
  FavoriteTracker,
  EligibilityProfile,
  loginMember,
  logoutMember,
  MemberProfile,
  MemberProfileInput,
  MemberSearchPreference,
  SavedSearchProfile,
  SearchPreferenceInput,
  mergeFavoriteIds,
  mergeComparisonIds,
  NoticeDetail,
  NoticeChange,
  NoticeSummary,
  NoticeSearchFacets,
  NoticeFreshness,
  saveSearchPreference,
  updateSavedSearchProfile,
  saveEligibilityProfile,
  revokeMemberSession,
  revokeOtherMemberSessions,
  requestEmailVerification,
  requestPasswordReset,
  resetPasswordWithToken,
  setFavorite,
  setComparison,
  signupMember,
  deleteMemberPersonalProfile,
  updateMemberProfile,
  updateFavoriteTracker,
  withdrawMember,
} from "./api";
import MemberDialogs, { MemberDialogMode } from "./MemberDialogs";
import AdminSyncDialog from "./AdminSyncDialog";
import NotificationsDialog from "./NotificationsDialog";
import FavoriteCalendarDialog from "./FavoriteCalendarDialog";
import RecommendationPanel from "./RecommendationPanel";
import { useMemberRecommendations } from "./useMemberRecommendations";
import { useHorizontalTabs } from "./useHorizontalTabs";
import { useLinkCopy } from "./useLinkCopy";
import LinkCopyFeedback from "./LinkCopyFeedback";
import ComparisonTable from "./ComparisonTable";
import { useOnlineStatus } from "./useOnlineStatus";
import RangeFilter from "./RangeFilter";
import { appendUniqueNotices } from "./noticePagination";
import { recentSearchLabel, removeRecentSearch } from "./recentSearchTools";
import { publicShareUrl } from "./shareLinkTools";
import { useSavedSearchProfiles } from "./useSavedSearchProfiles";
import SavedSearchProfilesPanel from "./SavedSearchProfilesPanel";
import { savedProfileInputError } from "./savedSearchTools";
import {
  buildEligibilityCheckResult,
  EligibilityAnswer,
  eligibilityQuestions,
} from "./eligibilityTools";
import { useDialogAccessibility } from "./useDialogAccessibility";
import {
  buildNoticeCalendar,
  noticeIdFromSearch,
  noticeSearchStateFromSearch,
  noticeSearchUrl,
  noticeUrl,
  normalizeRecentNoticeIds,
  NoticeSortKey,
  NoticeSearchState,
  RecentNoticeSearch,
  updateComparison,
  updateRecentNoticeIds,
  normalizeRecentNoticeSearches,
  updateRecentNoticeSearches,
} from "./noticeTools";
import { cacheNoticePage, noticePageCacheKey, noticePageStorage, readCachedNoticePage } from "./noticePageCache";

// 처음 화면에 너무 많은 카드를 만들지 않아 Render Free 기동 뒤의 체감 시간을 줄인다.
const NOTICE_PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;
const STATUS_KEYS: StatusKey[] = ["all", "today", "open", "upcoming"];
const noticePagePrefetches = new Map<string, ReturnType<typeof fetchNoticePage>>();

const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  SALE: "분양",
  PUBLIC_RENTAL: "공공임대",
};

const STATUS_LABELS: Record<StatusKey, string> = {
  all: "전체 청약",
  today: "오늘 마감",
  open: "접수중",
  upcoming: "오픈 예정",
};

const REGION_ORDER = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const RECENT_NOTICE_STORAGE_KEY = "cheongyak-one-recent-notices";
const RECENT_SEARCH_STORAGE_KEY = "cheongyak-one-recent-searches";

function eventFor(item: Application): { date: string; label: string; tone: string } | undefined {
  const today = koreaToday();
  if (item.applyStartDate && item.applyStartDate >= today) return { date: item.applyStartDate, label: "청약 접수 시작", tone: "blue-dot" };
  if (item.applyEndDate && item.applyEndDate >= today) return { date: item.applyEndDate, label: "청약 접수 마감", tone: "coral-dot" };
  if (item.winnerAnnounceDate && item.winnerAnnounceDate >= today) return { date: item.winnerAnnounceDate, label: "당첨자 발표", tone: "purple-dot" };
  return undefined;
}

function initialComparisonIds(): number[] {
  if (typeof window === "undefined") return [];

  try {
    // 공유 링크의 compare 값을 브라우저 저장값보다 우선한다.
    const params = new URLSearchParams(window.location.search);
    const source: unknown = params.has("compare")
      ? params.get("compare")?.split(",")
      : JSON.parse(window.localStorage.getItem("cheongyak-one-comparison") ?? "[]");
    if (!Array.isArray(source)) return [];
    return [...new Set(source.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 3);
  } catch {
    return [];
  }
}

function readGuestSavedIds(): Set<number> {
  try {
    const saved = window.localStorage.getItem("cheongyak-one-saved");
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => Number.isSafeInteger(id) && id > 0));
  } catch {
    window.localStorage.removeItem("cheongyak-one-saved");
    return new Set();
  }
}

function initialRecentNoticeIds(): number[] {
  try {
    return normalizeRecentNoticeIds(JSON.parse(window.localStorage.getItem(RECENT_NOTICE_STORAGE_KEY) ?? "[]"));
  } catch {
    try {
      window.localStorage.removeItem(RECENT_NOTICE_STORAGE_KEY);
    } catch {
      // 저장소 접근 자체가 차단된 브라우저에서도 빈 기록으로 시작한다.
    }
    return [];
  }
}

function initialRecentSearches(): RecentNoticeSearch[] {
  try {
    return normalizeRecentNoticeSearches(JSON.parse(window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY) ?? "[]"));
  } catch {
    try {
      window.localStorage.removeItem(RECENT_SEARCH_STORAGE_KEY);
    } catch {
      // 브라우저 저장소가 차단된 경우에도 검색 기능은 그대로 제공한다.
    }
    return [];
  }
}

function categoryValue(label: string): HousingCategory | undefined {
  return (Object.entries(CATEGORY_LABELS) as Array<[HousingCategory, string]>)
    .find(([, categoryLabel]) => categoryLabel === label)?.[0];
}

function isTemporaryApiConnectionError(error: unknown): boolean {
  return error instanceof ApiRequestTimeoutError
    || (error instanceof ApiError && [502, 503, 504].includes(error.status))
    || (error instanceof TypeError && /fetch|network/i.test(error.message));
}

const NOTICE_LOAD_RETRY_WINDOW_MS = 5 * 60_000;

function priceInManwon(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : undefined;
}

function priceInWon(value: string): number | undefined {
  const manwon = priceInManwon(value);
  return manwon === undefined ? undefined : manwon * 10_000;
}

function formatPricePreference(preference: MemberSearchPreference): string {
  if (preference.minPriceManwon && preference.maxPriceManwon) return `${preference.minPriceManwon.toLocaleString()}~${preference.maxPriceManwon.toLocaleString()}만원`;
  if (preference.minPriceManwon) return `${preference.minPriceManwon.toLocaleString()}만원 이상`;
  if (preference.maxPriceManwon) return `${preference.maxPriceManwon.toLocaleString()}만원 이하`;
  return "전체 예산";
}

function formatAreaPreference(preference: MemberSearchPreference): string {
  if (preference.minArea && preference.maxArea) return `${preference.minArea}~${preference.maxArea}㎡`;
  if (preference.minArea) return `${preference.minArea}㎡ 이상`;
  if (preference.maxArea) return `${preference.maxArea}㎡ 이하`;
  return "전체 면적";
}

function formatNoticeSort(sort: NoticeSortKey): string {
  return ({
    LATEST: "최신 공고순",
    DEADLINE: "마감 임박순",
    APPLY_START: "접수 시작일순",
    WINNER_ANNOUNCEMENT: "당첨 발표일순",
    PRICE_ASC: "낮은 분양가순",
    SUPPLY_DESC: "공급 세대 많은순",
  } as const)[sort];
}

export default function Home() {
  const online = useOnlineStatus();
  const initialSearch = noticeSearchStateFromSearch(window.location.search);
  const [notices, setNotices] = useState<NoticeSummary[]>([]);
  const [knownNotices, setKnownNotices] = useState<Map<number, NoticeSummary>>(new Map());
  const [noticeFacets, setNoticeFacets] = useState<NoticeSearchFacets>();
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [facetsError, setFacetsError] = useState(false);
  const [facetsVersion, setFacetsVersion] = useState(0);
  const [noticeFreshness, setNoticeFreshness] = useState<NoticeFreshness>();
  const [noticePage, setNoticePage] = useState(0);
  const [noticeTotal, setNoticeTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [moreMessage, setMoreMessage] = useState("");
  const [moreEnded, setMoreEnded] = useState(false);
  const [firstAddedNoticeId, setFirstAddedNoticeId] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadRetryPending, setLoadRetryPending] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [cachedListShownAt, setCachedListShownAt] = useState<number>();
  const automaticLoadRetryCount = useRef(0);
  const noticeLoadStartedAt = useRef(Date.now());
  const [query, setQuery] = useState(initialSearch.query);
  const [debouncedQuery, setDebouncedQuery] = useState(initialSearch.query);
  const [activeStatus, setActiveStatus] = useState<StatusKey>(initialSearch.status);
  const [includeClosed, setIncludeClosed] = useState(initialSearch.includeClosed);
  const [region, setRegion] = useState(initialSearch.region ?? "전체");
  const [category, setCategory] = useState(initialSearch.category ? CATEGORY_LABELS[initialSearch.category] : "전체");
  const [supplyType, setSupplyType] = useState<SupplyType | undefined>(initialSearch.supplyType);
  const [sortKey, setSortKey] = useState<NoticeSortKey>(initialSearch.sort);
  const [minPriceManwon, setMinPriceManwon] = useState(initialSearch.minPriceManwon ? String(initialSearch.minPriceManwon) : "");
  const [maxPriceManwon, setMaxPriceManwon] = useState(initialSearch.maxPriceManwon ? String(initialSearch.maxPriceManwon) : "");
  const [minArea, setMinArea] = useState(initialSearch.minArea ? String(initialSearch.minArea) : "");
  const [maxArea, setMaxArea] = useState(initialSearch.maxArea ? String(initialSearch.maxArea) : "");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [favoriteTrackers, setFavoriteTrackers] = useState<Map<number, FavoriteTracker>>(new Map());
  const [favoriteTrackerPendingId, setFavoriteTrackerPendingId] = useState<number>();
  const [favoritePendingId, setFavoritePendingId] = useState<number>();
  const [savedOnly, setSavedOnly] = useState(false);
  const [favoriteProgressFilter, setFavoriteProgressFilter] = useState<FavoriteProgressFilter>("ALL");
  const [favoriteKeyword, setFavoriteKeyword] = useState("");
  const [favoriteSortKey, setFavoriteSortKey] = useState<FavoriteSortKey>("PREPARATION");
  const [comparisonIds, setComparisonIds] = useState<number[]>(initialComparisonIds);
  const [comparisonPendingId, setComparisonPendingId] = useState<number>();
  const [comparisonResetPending, setComparisonResetPending] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [, setVisibleCount] = useState(6);
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceInvalid, setPriceInvalid] = useState(false);
  const [rangeResetVersion, setRangeResetVersion] = useState(0);
  const [areaInvalid, setAreaInvalid] = useState(false);
  const rangeInvalid = priceInvalid || areaInvalid;
  useEffect(() => { if (!filterOpen) { setPriceInvalid(false); setAreaInvalid(false); } }, [filterOpen]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<NoticeDetail | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<NoticeChange[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const detailRequest = useRef<AbortController | null>(null);
  const moreRequest = useRef<AbortController | null>(null);
  const [qualOpen, setQualOpen] = useState(false);
  const [qualStep, setQualStep] = useState(0);
  const [answers, setAnswers] = useState<EligibilityAnswer[]>([]);
  const [toast, setToast] = useState("");
  const [member, setMember] = useState<MemberProfile>();
  // A new login or completed session exit invalidates every previous account response.
  const memberScope = useRef(0);
  const [memberDialog, setMemberDialog] = useState<MemberDialogMode>(null);
  const [passwordResetToken, setPasswordResetToken] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [searchPreference, setSearchPreference] = useState<MemberSearchPreference>();
  const profilesState = useSavedSearchProfiles(member?.id, filterOpen);
  const [profileEditorError, setProfileEditorError] = useState("");
  const profileEditorEpoch = useRef(0);
  useEffect(() => { ++profileEditorEpoch.current; setEditingSavedSearchProfile(undefined); setProfileEditorError(""); }, [member?.id, filterOpen]);
  // 브라우저 프롬프트 대신 수정 대상을 유지해 모바일에서도 안전하게 편집한다.
  const [editingSavedSearchProfile, setEditingSavedSearchProfile] = useState<SavedSearchProfile>();
  const [savedSearchProfileName, setSavedSearchProfileName] = useState("");
  const [savedSearchProfileDraft, setSavedSearchProfileDraft] = useState<SearchPreferenceInput>({ status: "ALL", sort: "LATEST" });
  const [eligibilityProfile, setEligibilityProfile] = useState<EligibilityProfile>();
  const [eligibilityBusy, setEligibilityBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const recommendationState = useMemberRecommendations(member, searchPreference);
  const statusTabProps = useHorizontalTabs(activeStatus);
  const [adminSyncOpen, setAdminSyncOpen] = useState(false);
  const [favoriteCalendarOpen, setFavoriteCalendarOpen] = useState(false);
  const [detailRouteVersion, setDetailRouteVersion] = useState(0);
  const [recentNoticeIds, setRecentNoticeIds] = useState<number[]>(initialRecentNoticeIds);
  const [recentSearches, setRecentSearches] = useState<RecentNoticeSearch[]>(initialRecentSearches);
  const [searchUndo, setSearchUndo] = useState<{ before: NoticeSearchState; after: NoticeSearchState }>();
  const freshnessLoaded = useRef(false);

  const rememberNotice = (noticeId: number) => {
    setRecentNoticeIds((currentIds) => {
      const nextIds = updateRecentNoticeIds(currentIds, noticeId);
      try {
        window.localStorage.setItem(RECENT_NOTICE_STORAGE_KEY, JSON.stringify(nextIds));
      } catch {
        // 저장 공간이 차단돼도 상세 공고 조회는 그대로 유지한다.
      }
      return nextIds;
    });
  };

  const clearRecentNotices = () => {
    setRecentNoticeIds([]);
    try {
      window.localStorage.removeItem(RECENT_NOTICE_STORAGE_KEY);
    } catch {
      // 브라우저 저장소가 차단된 경우 현재 화면 상태만 비운다.
    }
  };

  const clearDetail = () => {
    detailRequest.current?.abort();
    detailRequest.current = null;
    setDetailError("");
    setSelected(null);
    setSelectedDetail(null);
    setSelectedChanges([]);
    setDetailLoading(false);
  };

  const closeDetail = () => {
    if (!noticeIdFromSearch(window.location.search)) {
      clearDetail();
      return;
    }
    if (window.history.state?.cheongyakNoticeModal) {
      clearDetail();
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", noticeUrl(window.location.href));
    clearDetail();
  };

  const applySearchPreference = (preference: MemberSearchPreference) => {
    setRegion(preference.region ?? "전체");
    setCategory(preference.housingCategory ? CATEGORY_LABELS[preference.housingCategory] : "전체");
    setSupplyType(preference.supplyType);
    setActiveStatus(preference.status.toLowerCase() as StatusKey);
    setIncludeClosed(false);
    setSortKey(preference.sort);
    setMinPriceManwon(preference.minPriceManwon ? String(preference.minPriceManwon) : "");
    setMaxPriceManwon(preference.maxPriceManwon ? String(preference.maxPriceManwon) : "");
    setMinArea(preference.minArea ? String(preference.minArea) : "");
    setMaxArea(preference.maxArea ? String(preference.maxArea) : "");
    setSavedOnly(false);
    setVisibleCount(6);
  };

  const currentSearchRequest = (statusKey: StatusKey = activeStatus) => ({
    category: categoryValue(category),
    supplyType,
    status: statusKey === "open" ? "OPEN" as const : statusKey === "upcoming" ? "UPCOMING" as const : undefined,
    keyword: debouncedQuery,
    region: region === "전체" ? undefined : region,
    minPrice: priceInWon(minPriceManwon),
    maxPrice: priceInWon(maxPriceManwon),
    minArea: priceInManwon(minArea),
    maxArea: priceInManwon(maxArea),
    ids: savedOnly ? [...savedIds] : undefined,
    endingToday: statusKey === "today",
    activeOnly: statusKey === "all" && !includeClosed,
    sort: sortKey,
    size: NOTICE_PAGE_SIZE,
  });

  const currentSearchState = (): NoticeSearchState => ({
    query: query.trim(),
    status: activeStatus,
    region: region === "전체" ? undefined : region,
    category: categoryValue(category),
    supplyType,
    minPriceManwon: priceInManwon(minPriceManwon),
    maxPriceManwon: priceInManwon(maxPriceManwon),
    minArea: priceInManwon(minArea),
    maxArea: priceInManwon(maxArea),
    includeClosed,
    sort: sortKey,
  });

  const rememberSearch = (state = currentSearchState()) => {
    setRecentSearches((current) => {
      const next = updateRecentNoticeSearches(current, state);
      try {
        window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장에 실패해도 선택한 검색 조건은 현재 화면에서 계속 적용한다.
      }
      return next;
    });
  };

  const applyRecentSearch = (state: NoticeSearchState, recordHistory = true) => {
    setQuery(state.query);
    setDebouncedQuery(state.query);
    setActiveStatus(state.status);
    setRegion(state.region ?? "전체");
    setCategory(state.category ? CATEGORY_LABELS[state.category] : "전체");
    setSupplyType(state.supplyType);
    setMinPriceManwon(state.minPriceManwon ? String(state.minPriceManwon) : "");
    setMaxPriceManwon(state.maxPriceManwon ? String(state.maxPriceManwon) : "");
    setMinArea(state.minArea ? String(state.minArea) : "");
    setMaxArea(state.maxArea ? String(state.maxArea) : "");
    setIncludeClosed(state.includeClosed);
    setSortKey(state.sort);
    setSavedOnly(false);
    resetVisible();
    if (recordHistory) rememberSearch(state);
    scrollToResults();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    document.querySelector<HTMLInputElement>('input[aria-label="청약 검색어"]')?.focus({ preventScroll: true });
    try {
      window.localStorage.removeItem(RECENT_SEARCH_STORAGE_KEY);
      setToast("최근 검색을 모두 삭제했습니다.");
    } catch {
      setToast("화면에서 삭제했습니다. 브라우저 저장소에 반영하지 못해 새로고침하면 다시 나타날 수 있습니다.");
    }
  };

  const deleteRecentSearch = (item: RecentNoticeSearch) => {
    const next = removeRecentSearch(recentSearches, item);
    setRecentSearches(next);
    document.querySelector<HTMLInputElement>('input[aria-label="청약 검색어"]')?.focus({ preventScroll: true });
    try {
      window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(next));
      setToast("선택한 최근 검색을 삭제했습니다.");
    } catch {
      setToast("화면에서 삭제했습니다. 브라우저 저장소에 반영하지 못해 새로고침하면 다시 나타날 수 있습니다.");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    // 검색 조건 변경 또는 재연결 시 제한된 자동 재시도를 다시 허용한다.
    automaticLoadRetryCount.current = 0;
    noticeLoadStartedAt.current = Date.now();
    setLoadRetryPending(false);
  }, [online, activeStatus, category, debouncedQuery, includeClosed, maxArea, maxPriceManwon, minArea, minPriceManwon, region, savedIds, savedOnly, sortKey, supplyType]);

  const retryNoticeLoad = () => {
    if (!online) return;
    automaticLoadRetryCount.current = 0;
    noticeLoadStartedAt.current = Date.now();
    setLoadRetryPending(false);
    setLoadVersion((version) => version + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    const request = currentSearchRequest("all");
    if (!online) { setFacetsLoading(false); return; }
    const startedAt = Date.now();
    let retryCount = 0;
    let retryTimer: number | undefined;
    setNoticeFacets(undefined);
    setFacetsLoading(true);
    setFacetsError(false);
    const loadFacets = async () => {
      try {
        const facets = await fetchNoticeFacets({
          category: request.category,
          supplyType: request.supplyType,
          keyword: request.keyword,
          region: request.region,
          minPrice: request.minPrice,
          maxPrice: request.maxPrice,
          minArea: request.minArea,
          maxArea: request.maxArea,
        }, controller.signal);
        if (controller.signal.aborted) return;
        setNoticeFacets(facets);
        setFacetsLoading(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        const remainingWait = NOTICE_LOAD_RETRY_WINDOW_MS - (Date.now() - startedAt);
        if (isTemporaryApiConnectionError(error) && remainingWait > 0) {
          const retryDelay = Math.min(3_500 * 2 ** Math.min(retryCount++, 3), 15_000, remainingWait);
          retryTimer = window.setTimeout(() => { void loadFacets(); }, retryDelay);
          return;
        }
        setFacetsLoading(false);
        setFacetsError(true);
      }
    };
    // 목록 요청과 독립적으로 복구하므로 집계 실패가 공고 탐색을 막지 않는다.
    void loadFacets();
    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      controller.abort();
    };
  }, [online, category, debouncedQuery, facetsVersion, maxArea, maxPriceManwon, minArea, minPriceManwon, region, supplyType]);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: number | undefined;
    if (!online) { setLoading(false); setLoadRetryPending(false); setLoadError(""); return; }
    const timer = window.setTimeout(() => {
      const request = currentSearchRequest();
      if (savedOnly && request.ids?.length === 0) {
        setNotices([]);
        setNoticeTotal(0);
        setLoadError("");
        setLoadRetryPending(false);
        setLoading(false);
        return;
      }
      const cacheKey = noticePageCacheKey({ ...request, page: 0 });
      const storage = noticePageStorage(window);
      const cached = savedOnly ? undefined : readCachedNoticePage(storage, cacheKey);
      setLoading(!cached);
      setCachedListShownAt(cached?.cachedAt);
      if (!loadRetryPending) setLoadError("");
      if (cached) {
        setNotices(cached.page.content);
        setNoticePage(cached.page.number);
        setNoticeTotal(cached.page.totalElements);
        setKnownNotices((known) => {
          const next = new Map(known);
          cached.page.content.forEach((notice) => next.set(notice.id, notice));
          return next;
        });
      }

      // 캐시를 즉시 표시하되, 백그라운드에서 최신 목록으로 갱신한다.
      const activePageRequest = noticePagePrefetches.get(cacheKey)
        ?? fetchNoticePage({ ...request, page: 0 }, controller.signal);

      // 첫 화면이 표시되는 동안 다른 상태 탭의 첫 페이지도 받아 두어 탭 전환을 즉시 처리한다.
      if (!savedOnly) {
        STATUS_KEYS.filter((statusKey) => statusKey !== activeStatus).forEach((statusKey) => {
          const prefetchRequest = { ...currentSearchRequest(statusKey), page: 0 };
          const prefetchCacheKey = noticePageCacheKey(prefetchRequest);
          if (readCachedNoticePage(storage, prefetchCacheKey) || noticePagePrefetches.has(prefetchCacheKey)) return;
          const prefetch = fetchNoticePage(prefetchRequest);
          noticePagePrefetches.set(prefetchCacheKey, prefetch);
          void prefetch
            .then((page) => cacheNoticePage(storage, prefetchCacheKey, page))
            // 사전 요청 실패는 현재 탭의 목록 사용을 막지 않는다.
            .catch(() => undefined)
            .finally(() => noticePagePrefetches.delete(prefetchCacheKey));
        });
      }

      activePageRequest!
        .then((page) => {
        if (controller.signal.aborted) return;
        automaticLoadRetryCount.current = 0;
        setLoadRetryPending(false);
        setLoadError("");
        if (!savedOnly) cacheNoticePage(storage, cacheKey, page);
        setNotices(page.content);
        setNoticePage(0);
        setNoticeTotal(page.totalElements);
        setCachedListShownAt(undefined);
        setKnownNotices((known) => {
          const next = new Map(known);
          page.content.forEach((notice) => next.set(notice.id, notice));
          return next;
        });

        if (!freshnessLoaded.current) {
          freshnessLoaded.current = true;
          void fetchNoticeFreshness(controller.signal)
            .then((freshness) => setNoticeFreshness(freshness))
            // 기준 시각을 가져오지 못해도 공고 검색 기능은 그대로 동작해야 한다.
            .catch(() => { freshnessLoaded.current = false; });
        }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          const remainingWait = NOTICE_LOAD_RETRY_WINDOW_MS - (Date.now() - noticeLoadStartedAt.current);
          if (isTemporaryApiConnectionError(error) && remainingWait > 0) {
            automaticLoadRetryCount.current += 1;
            const retryDelay = Math.min(3_500 * 2 ** Math.min(automaticLoadRetryCount.current - 1, 3), 15_000, remainingWait);
            setLoadRetryPending(true);
            setLoadError(`서버에 연결하지 못했어요. ${Math.ceil(retryDelay / 1_000)}초 후 자동으로 다시 시도합니다.`);
            retryTimer = window.setTimeout(() => setLoadVersion((version) => version + 1), retryDelay);
            return;
          }
          setLoadRetryPending(false);
          setLoadError(error instanceof Error ? error.message : "청약 정보를 불러오지 못했습니다.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); if (retryTimer) window.clearTimeout(retryTimer); controller.abort(); };
  }, [online, activeStatus, category, debouncedQuery, includeClosed, loadVersion, maxArea, maxPriceManwon, minArea, minPriceManwon, region, savedIds, savedOnly, sortKey, supplyType]);

  const loadMoreNotices = async () => {
    if (!online) return;
    if (moreRequest.current || loadingMore || loading || moreEnded || notices.length >= noticeTotal) return;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(true);
    setMoreError("");
    setMoreMessage("");
    setFirstAddedNoticeId(undefined);
    try {
      const page = await fetchNoticePage({ ...currentSearchRequest(), page: noticePage + 1 }, controller.signal);
      if (controller.signal.aborted || moreRequest.current !== controller) return;
      const merged = appendUniqueNotices(notices, page.content);
      setNotices(merged.items);
      setNoticeTotal(page.totalElements);
      setMoreEnded(page.content.length === 0 || page.number + 1 >= page.totalPages);
      setMoreMessage(merged.added.length ? `공고 ${merged.added.length}건을 추가로 불러왔습니다.` : "추가로 표시할 공고가 없습니다. 최신 목록이 필요하면 다시 불러오세요.");
      setFirstAddedNoticeId(merged.added[0]?.id);
      setNoticePage(page.number);
      setKnownNotices((known) => {
        const next = new Map(known);
        page.content.forEach((notice) => next.set(notice.id, notice));
        return next;
      });
    } catch (error) {
      if (controller.signal.aborted || moreRequest.current !== controller) return;
      setMoreError(error instanceof Error ? error.message : "다음 공고를 불러오지 못했습니다.");
    } finally {
      if (moreRequest.current === controller) { moreRequest.current = null; setLoadingMore(false); }
    }
  };

  useEffect(() => {
    moreRequest.current?.abort();
    moreRequest.current = null;
    setLoadingMore(false);
    setMoreError("");
    setMoreMessage("");
    setMoreEnded(false);
    setFirstAddedNoticeId(undefined);
    return () => { moreRequest.current?.abort(); };
  }, [online, activeStatus, category, debouncedQuery, includeClosed, loadVersion, maxArea, maxPriceManwon, minArea, minPriceManwon, region, savedIds, savedOnly, sortKey, supplyType]);

  useEffect(() => () => { detailRequest.current?.abort(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get("verifyEmail");
    const resetToken = params.get("resetPassword");
    if (verificationToken) {
      params.delete("verifyEmail");
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
      confirmEmailVerification(verificationToken)
        .then(() => {
          setMemberDialog("login");
          setToast("이메일 인증이 완료됐습니다. 로그인해주세요.");
        })
        .catch((error: unknown) => {
          setMemberDialog("verify-email");
          setToast(error instanceof Error ? error.message : "이메일 인증 링크를 확인하지 못했습니다.");
        });
      return;
    }
    if (resetToken) {
      params.delete("resetPassword");
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`);
      setPasswordResetToken(resetToken);
      setMemberDialog("reset-password");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const epoch = memberScope.current;
    const stale = () => cancelled || epoch !== memberScope.current;
    const guestSavedIds = readGuestSavedIds();
    setSavedIds(guestSavedIds);

    fetchCurrentMember()
      .then(async (profile) => {
        if (!profile) return;
        if (stale()) return;
        setMember(profile);
        try {
          const accountIds = guestSavedIds.size > 0
            ? await mergeFavoriteIds([...guestSavedIds])
            : await fetchFavoriteIds();
          if (stale()) return;
          setSavedIds(new Set(accountIds));
          const trackers = await fetchFavoriteTrackers();
          if (stale()) return;
          setFavoriteTrackers(new Map(trackers.map((tracker) => [tracker.noticeId, tracker])));
          // 로그인 계정의 목록이 로그아웃 뒤 다른 사용자에게 보이지 않게 브라우저 복사본을 지운다.
          window.localStorage.removeItem("cheongyak-one-saved");
        } catch (error) {
          if (!stale()) setToast(error instanceof Error ? error.message : "관심청약을 동기화하지 못했습니다.");
        }
        if (stale()) return;
        try {
          const accountComparisonIds = comparisonIds.length > 0
            ? await mergeComparisonIds(comparisonIds)
            : await fetchComparisonIds();
          if (stale()) return;
          setComparisonIds(accountComparisonIds);
          window.localStorage.removeItem("cheongyak-one-comparison");
        } catch (error) {
          if (!stale()) setToast(error instanceof Error ? error.message : "비교 목록을 동기화하지 못했습니다.");
        }
        if (stale()) return;
        try {
          const preference = await fetchSearchPreference();
          if (stale()) return;
          setSearchPreference(preference);
          if (preference) applySearchPreference(preference);
        } catch (error) {
          if (!stale()) setToast(error instanceof Error ? error.message : "저장한 검색조건을 불러오지 못했습니다.");
        }
        if (stale()) return;
        try {
          const profiles = await fetchSavedSearchProfiles();
          if (!stale()) {
            // 로그인 직후에는 기본 프로필을 우선 적용해 이전 단일 검색조건보다 예측 가능한 시작 화면을 제공한다.
            const defaultProfile = profiles.find((item) => item.defaultProfile);
            if (defaultProfile) applySearchPreference(defaultProfile);
          }
        } catch (error) {
          if (!stale()) setToast(error instanceof Error ? error.message : "저장 검색조건 목록을 불러오지 못했습니다.");
        }
        if (stale()) return;
        try {
          const profile = await fetchEligibilityProfile();
          if (!stale()) setEligibilityProfile(profile);
        } catch (error) {
          if (!stale()) setToast(error instanceof Error ? error.message : "저장한 사전점검을 불러오지 못했습니다.");
        }
      })
      .catch((error: unknown) => {
        if (!stale()) setToast(error instanceof Error ? error.message : "회원 정보를 확인하지 못했습니다.");
      })
      .finally(() => {
        if (!stale()) setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!member) {
      setUnreadNotificationCount(0);
      return;
    }
    // The open inbox owns refreshing and the badge update. Do not race it with
    // a second visibility/timer request from the page behind the dialog.
    if (notificationsOpen) return;
    let cancelled = false;
    let refreshing = false;
    const refreshUnreadCount = () => {
      if (cancelled || refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      fetchNotificationInbox()
        .then((inbox) => { if (!cancelled) setUnreadNotificationCount(inbox.unreadCount); })
        .catch(() => {
          // 일시적인 갱신 실패 시 기존 개수를 유지하고 다음 주기에 다시 시도한다.
        }).finally(() => { refreshing = false; });
    };
    refreshUnreadCount();
    const timer = window.setInterval(refreshUnreadCount, 60_000);
    document.addEventListener("visibilitychange", refreshUnreadCount);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshUnreadCount);
    };
  }, [member, notificationsOpen]);



  useEffect(() => {
    const onPopState = () => {
      const restored = noticeSearchStateFromSearch(window.location.search);
      setQuery(restored.query);
      setActiveStatus(restored.status);
      setIncludeClosed(restored.includeClosed);
      setRegion(restored.region ?? "전체");
      setCategory(restored.category ? CATEGORY_LABELS[restored.category] : "전체");
      setSupplyType(restored.supplyType);
      setSortKey(restored.sort);
      setSavedOnly(false);
      setVisibleCount(6);
      setDetailRouteVersion((version) => version + 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const noticeId = noticeIdFromSearch(window.location.search);
    if (!noticeId) {
      if (new URLSearchParams(window.location.search).has("notice")) {
        window.history.replaceState(window.history.state, "", noticeUrl(window.location.href));
      }
      clearDetail();
      return;
    }

    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailError("");
    setDetailLoading(true);
    Promise.all([
      fetchNotice(noticeId, controller.signal),
      fetchNoticeChanges(noticeId, controller.signal).catch(() => [] as NoticeChange[]),
    ])
      .then(([detail, changes]) => {
        if (controller.signal.aborted || detailRequest.current !== controller) return;
        setSelected(toApplication(detail));
        setSelectedDetail(detail);
        setSelectedChanges(changes);
        setKnownNotices((known) => new Map(known).set(detail.id, detail));
        rememberNotice(detail.id);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || detailRequest.current !== controller) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        clearDetail();
        window.history.replaceState(window.history.state, "", noticeUrl(window.location.href));
        setToast(error instanceof Error ? error.message : "공고 상세 링크를 확인하지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted && detailRequest.current === controller) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [detailRouteVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const requestedIds = [...new Set([...comparisonIds, ...recentNoticeIds])]
      .filter((id) => !knownNotices.has(id));
    if (requestedIds.length === 0) return () => controller.abort();
    Promise.allSettled(requestedIds.map((id) => fetchNotice(id, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        setKnownNotices((known) => {
          const next = new Map(known);
          results.forEach((result) => {
            if (result.status === "fulfilled") next.set(result.value.id, result.value);
          });
          return next;
        });
      });
    return () => controller.abort();
  }, [comparisonIds.join(","), recentNoticeIds.join(",")]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    // 비회원은 브라우저에, 회원은 서버에 저장하고 URL에는 공유 가능한 목록을 반영한다.
    try {
      if (member) window.localStorage.removeItem("cheongyak-one-comparison");
      else window.localStorage.setItem("cheongyak-one-comparison", JSON.stringify(comparisonIds));
    } catch {
      if (!member && comparisonIds.length) setToast("브라우저 저장이 제한되어 비교 목록은 현재 화면에서만 유지됩니다.");
    }
    const searchUrl = noticeSearchUrl(window.location.href, {
      query,
      status: activeStatus,
      includeClosed,
      region: region === "전체" ? undefined : region,
      category: categoryValue(category),
      supplyType,
      minPriceManwon: priceInManwon(minPriceManwon),
      maxPriceManwon: priceInManwon(maxPriceManwon),
      minArea: priceInManwon(minArea),
      maxArea: priceInManwon(maxArea),
      sort: sortKey,
    });
    const targetUrl = new URL(searchUrl);
    const params = targetUrl.searchParams;
    if (comparisonIds.length > 0) params.set("compare", comparisonIds.join(","));
    else params.delete("compare");
    window.history.replaceState(window.history.state, "", targetUrl.toString());
  }, [activeStatus, category, comparisonIds, includeClosed, maxArea, maxPriceManwon, member, minArea, minPriceManwon, query, region, sortKey, supplyType]);

  useEffect(() => {
    if (comparisonOpen && comparisonIds.length < 2) setComparisonOpen(false);
  }, [comparisonIds.length, comparisonOpen]);

  const applications = useMemo(() => notices.map(toApplication), [notices]);
  const availableRegions = REGION_ORDER;
  const availableCategories = ["아파트", "오피스텔", "공공임대"];
  const filtered = applications;
  const knownApplications = useMemo(() => [...knownNotices.values()].map(toApplication), [knownNotices]);

  const comparisonNotices = useMemo(() => comparisonIds
    .map((id) => knownApplications.find((item) => item.id === id))
    .filter((item): item is Application => Boolean(item)), [knownApplications, comparisonIds]);
  const savedNotices = useMemo(() => knownApplications.filter((item) => savedIds.has(item.id)), [knownApplications, savedIds]);
  const upcomingFavoriteEvents = useMemo(() => savedNotices.flatMap((item) => [
    item.applyStartDate ? { date: item.applyStartDate, label: "접수 시작", item } : undefined,
    item.applyEndDate ? { date: item.applyEndDate, label: "접수 마감", item } : undefined,
    item.winnerAnnounceDate ? { date: item.winnerAnnounceDate, label: "당첨 발표", item } : undefined,
  ]).filter((event): event is { date: string; label: string; item: Application } => Boolean(event && event.date >= koreaToday())).sort((left, right) => left.date.localeCompare(right.date)).slice(0, 5), [savedNotices]);
  const resultDueFavoriteEvents = useMemo(() => savedNotices
    .filter((item) => {
      const tracker = favoriteTrackers.get(item.id);
      return tracker?.progress === "APPLIED" && (tracker.applicationResult ?? "PENDING") === "PENDING" && Boolean(item.winnerAnnounceDate) && item.winnerAnnounceDate! <= koreaToday();
    })
    .map((item) => ({ item, date: item.winnerAnnounceDate! }))
    .sort((left, right) => left.date.localeCompare(right.date)), [favoriteTrackers, savedNotices]);
  const recentNotices = useMemo(() => recentNoticeIds
    .map((id) => knownApplications.find((item) => item.id === id))
    .filter((item): item is Application => Boolean(item)), [knownApplications, recentNoticeIds]);

  const favoritePreparation = useMemo(() => {
    const counts: Record<FavoriteProgress, number> = { SAVED: 0, CHECKING: 0, READY: 0, APPLIED: 0 };
    const applicationResults: Record<FavoriteApplicationResult, number> = { PENDING: 0, SELECTED: 0, WAITLISTED: 0, NOT_SELECTED: 0 };
    let urgent = 0;
    let checklistIncomplete = 0;
    const today = koreaToday();

    savedIds.forEach((noticeId) => {
      const progress = favoriteTrackers.get(noticeId)?.progress ?? "SAVED";
      counts[progress] += 1;
      if (progress === "APPLIED") applicationResults[favoriteTrackers.get(noticeId)?.applicationResult ?? "PENDING"] += 1;
      if (progress !== "APPLIED" && completedChecklistCount(favoriteTrackers.get(noticeId)) < FAVORITE_CHECKLIST_ITEMS.length) checklistIncomplete += 1;
      const item = knownApplications.find((application) => application.id === noticeId);
      if (!item) return;
      const remaining = daysBetween(today, item.applyEndDate);
      if (progress !== "APPLIED" && remaining !== undefined && remaining >= 0 && remaining <= 3) urgent += 1;
    });

    return { counts, applicationResults, recordedResults: applicationResults.SELECTED + applicationResults.WAITLISTED + applicationResults.NOT_SELECTED, urgent, checklistIncomplete, resultDue: resultDueFavoriteEvents.length };
  }, [favoriteTrackers, knownApplications, resultDueFavoriteEvents.length, savedIds]);
  const visible = useMemo(() => {
    if (!savedOnly) return filtered;

    return filtered.filter((item) => {
      const tracker = favoriteTrackers.get(item.id);
      const normalizedKeyword = favoriteKeyword.trim().toLocaleLowerCase("ko-KR");
      if (normalizedKeyword && ![item.title, item.location, item.region, tracker?.memo ?? ""].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedKeyword))) return false;
      if (favoriteProgressFilter === "ALL") return true;
      if (favoriteProgressFilter === "INCOMPLETE") return (tracker?.progress ?? "SAVED") !== "APPLIED" && completedChecklistCount(tracker) < FAVORITE_CHECKLIST_ITEMS.length;
      if (favoriteProgressFilter === "URGENT") {
        const remaining = daysBetween(koreaToday(), item.applyEndDate);
        return (tracker?.progress ?? "SAVED") !== "APPLIED" && remaining !== undefined && remaining >= 0 && remaining <= 3;
      }
      if (favoriteProgressFilter === "RESULT_DUE") return tracker?.progress === "APPLIED" && (tracker.applicationResult ?? "PENDING") === "PENDING" && Boolean(item.winnerAnnounceDate) && item.winnerAnnounceDate! <= koreaToday();
      const applicationResult = applicationResultFromFilter(favoriteProgressFilter);
      if (applicationResult) return tracker?.progress === "APPLIED" && (tracker.applicationResult ?? "PENDING") === applicationResult;
      return (tracker?.progress ?? "SAVED") === favoriteProgressFilter;
    }).sort((left, right) => {
      const leftProgress = favoriteTrackers.get(left.id)?.progress ?? "SAVED";
      const rightProgress = favoriteTrackers.get(right.id)?.progress ?? "SAVED";
      const deadlineOrder = (dateValue(left.applyEndDate) ?? Number.MAX_SAFE_INTEGER) - (dateValue(right.applyEndDate) ?? Number.MAX_SAFE_INTEGER);
      if (favoriteSortKey === "DEADLINE") return deadlineOrder;
      if (favoriteSortKey === "RESULT") {
        const leftResult = leftProgress === "APPLIED" ? favoriteTrackers.get(left.id)?.applicationResult ?? "PENDING" : undefined;
        const rightResult = rightProgress === "APPLIED" ? favoriteTrackers.get(right.id)?.applicationResult ?? "PENDING" : undefined;
        const resultOrder = (leftResult ? FAVORITE_APPLICATION_RESULT_PRIORITY[leftResult] : Number.MAX_SAFE_INTEGER) - (rightResult ? FAVORITE_APPLICATION_RESULT_PRIORITY[rightResult] : Number.MAX_SAFE_INTEGER);
        return resultOrder !== 0 ? resultOrder : deadlineOrder;
      }
      const progressOrder = FAVORITE_PROGRESS_PRIORITY[leftProgress] - FAVORITE_PROGRESS_PRIORITY[rightProgress];
      if (progressOrder !== 0) return progressOrder;
      if (leftProgress === "APPLIED" && rightProgress === "APPLIED") {
        const resultOrder = FAVORITE_APPLICATION_RESULT_PRIORITY[favoriteTrackers.get(left.id)?.applicationResult ?? "PENDING"] - FAVORITE_APPLICATION_RESULT_PRIORITY[favoriteTrackers.get(right.id)?.applicationResult ?? "PENDING"];
        if (resultOrder !== 0) return resultOrder;
      }
      return deadlineOrder;
    });
  }, [favoriteKeyword, favoriteProgressFilter, favoriteSortKey, favoriteTrackers, filtered, savedOnly]);
  const activeFilterCount = Number(region !== "전체") + Number(category !== "전체") + Number(Boolean(supplyType)) + Number(Boolean(minPriceManwon || maxPriceManwon)) + Number(Boolean(minArea || maxArea)) + Number(includeClosed);
  const activeFilterLabels = [
    region !== "전체" ? region : undefined,
    category !== "전체" ? category : undefined,
    supplyType ? SUPPLY_TYPE_LABELS[supplyType] : undefined,
    minPriceManwon || maxPriceManwon ? `${minPriceManwon || "0"}~${maxPriceManwon || "무제한"}만원` : undefined,
    minArea || maxArea ? `${minArea || "0"}~${maxArea || "무제한"}㎡` : undefined,
    includeClosed ? "마감 공고 포함" : undefined,
  ].filter((value): value is string => Boolean(value));
  const todayCount = noticeFacets?.endingToday ?? 0;
  const openCount = noticeFacets?.open ?? 0;
  const upcomingCount = noticeFacets?.upcoming ?? 0;
  const facetsUnavailable = facetsLoading || !noticeFacets;
  const statuses: { key: StatusKey; label: string; count: number; tone: string; icon: IconName }[] = [
    { key: "all", label: includeClosed ? "전체 청약" : "모집 중·예정", count: includeClosed ? noticeFacets?.total ?? 0 : openCount + upcomingCount, tone: "navy", icon: "grid" },
    { key: "today", label: "오늘 마감", count: todayCount, tone: "coral", icon: "bell" },
    { key: "open", label: "접수중", count: openCount, tone: "mint", icon: "check" },
    { key: "upcoming", label: "오픈 예정", count: upcomingCount, tone: "blue", icon: "calendar" },
  ];
  const schedule = useMemo(() => applications
    .map((item) => ({ item, event: eventFor(item) }))
    .filter((entry): entry is { item: Application; event: { date: string; label: string; tone: string } } => Boolean(entry.event))
    .sort((a, b) => a.event.date.localeCompare(b.event.date))
    .slice(0, 3), [applications]);
  const highlight = applications.find((item) => item.statusKey === "today")
    ?? applications.find((item) => item.statusKey === "open")
    ?? schedule[0]?.item;
  const highlightEvent = highlight ? eventFor(highlight) : undefined;
  const syncedAt = noticeFreshness?.lastCompletedAt ?? notices.map((notice) => notice.syncedAt).sort().at(-1);
  const syncedLabel = syncedAt ? new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(syncedAt)) : "동기화 전";
  const dataFreshnessMessage = cachedListShownAt
    ? "마지막으로 확인한 목록을 먼저 표시 중입니다"
    : noticeFreshness?.status === "DELAYED"
    ? `일부 유형 갱신 지연 · 유형별 수집 현황을 확인하세요`
    : noticeFreshness?.status === "UNAVAILABLE"
      ? "동기화 기록을 확인 중입니다"
      : `최근 동기화 ${syncedLabel}`;
  const today = koreaToday();
  const [, thisMonth, thisDay] = today.split("-").map(Number);

  const scrollToResults = () => {
    const results = document.getElementById("applications");
    results?.focus({ preventScroll: true });
    results?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const resetVisible = () => setVisibleCount(6);
  const resetSearchConditions = () => {
    setSearchUndo({ before: currentSearchState(), after: { query: "", status: "all", includeClosed: false, sort: sortKey } });
    setQuery(""); setDebouncedQuery(""); setRegion("전체"); setCategory("전체");
    setSupplyType(undefined); setMinPriceManwon(""); setMaxPriceManwon("");
    setMinArea(""); setMaxArea(""); setIncludeClosed(false);
    setActiveStatus("all"); setSavedOnly(false); resetVisible();
  };
  const removableConditions = [
    ...(query ? [{ key: "query", label: `검색어: ${query}`, clear: () => { setQuery(""); setDebouncedQuery(""); } }] : []),
    ...(region !== "전체" ? [{ key: "region", label: `지역: ${region}`, clear: () => setRegion("전체") }] : []),
    ...(category !== "전체" ? [{ key: "category", label: `유형: ${category}`, clear: () => setCategory("전체") }] : []),
    ...(supplyType ? [{ key: "supply", label: `공급: ${SUPPLY_TYPE_LABELS[supplyType]}`, clear: () => setSupplyType(undefined) }] : []),
    ...(minPriceManwon || maxPriceManwon ? [{ key: "price", label: "예산", clear: () => { setMinPriceManwon(""); setMaxPriceManwon(""); } }] : []),
    ...(minArea || maxArea ? [{ key: "area", label: "면적", clear: () => { setMinArea(""); setMaxArea(""); } }] : []),
    ...(includeClosed ? [{ key: "closed", label: "마감 공고 포함", clear: () => setIncludeClosed(false) }] : []),
    ...(activeStatus !== "all" ? [{ key: "status", label: `상태: ${statuses.find(status => status.key === activeStatus)?.label}`, clear: () => setActiveStatus("all") }] : []),
  ];
  const conditionResets: Record<string, Partial<NoticeSearchState>> = {
    query: { query: "" }, region: { region: undefined }, category: { category: undefined },
    supply: { supplyType: undefined }, price: { minPriceManwon: undefined, maxPriceManwon: undefined },
    area: { minArea: undefined, maxArea: undefined }, closed: { includeClosed: false }, status: { status: "all" },
  };
  const searchStateKey = noticeSearchUrl("https://search.invalid/", currentSearchState());
  useEffect(() => {
    if (searchUndo && (savedOnly || searchStateKey !== noticeSearchUrl("https://search.invalid/", searchUndo.after))) setSearchUndo(undefined);
  }, [searchStateKey, savedOnly, searchUndo]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setDebouncedQuery(query);
    setLoadVersion((version) => version + 1);
    setActiveStatus("all");
    setSavedOnly(false);
    rememberSearch({ ...currentSearchState(), status: "all" });
    resetVisible();
    scrollToResults();
  };

  const toggleSaved = async (id: number) => {
    const epoch = memberScope.current;
    if (favoritePendingId !== undefined) return;
    const next = new Set(savedIds);
    const isSaving = !next.has(id);
    if (isSaving) next.add(id); else next.delete(id);
    setSavedIds(next);
    if (!member) {
      try { window.localStorage.setItem("cheongyak-one-saved", JSON.stringify([...next])); }
      catch { setToast("브라우저 저장이 제한되어 관심 목록은 현재 화면에서만 유지됩니다."); return; }
      setToast(isSaving ? "관심청약에 저장했어요." : "관심청약에서 삭제했어요.");
      return;
    }

    setFavoritePendingId(id);
    try {
      const ids = await setFavorite(id, isSaving);
      if (epoch !== memberScope.current) return;
      setSavedIds(new Set(ids));
      if (!isSaving) setFavoriteTrackers((current) => {
        const nextTrackers = new Map(current);
        nextTrackers.delete(id);
        return nextTrackers;
      });
      setToast(isSaving ? "계정 관심청약에 저장했어요." : "관심청약에서 삭제했어요.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setSavedIds(new Set(savedIds));
      setToast(error instanceof Error ? error.message : "관심청약을 변경하지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setFavoritePendingId(undefined);
    }
  };

  const saveFavoriteTracker = async (
    noticeId: number,
    progress: FavoriteProgress,
    memo: string,
    checklist: Partial<Pick<FavoriteTracker, FavoriteChecklistKey>> = {},
    applicationResult?: FavoriteApplicationResult,
    applicationResultMemo?: string,
  ) => {
    if (!member || favoriteTrackerPendingId !== undefined) return;
    const current = favoriteTrackers.get(noticeId);
    setFavoriteTrackerPendingId(noticeId);
    const epoch = memberScope.current;
    try {
      const tracker = await updateFavoriteTracker(noticeId, {
        progress,
        applicationResult: applicationResult ?? current?.applicationResult ?? "PENDING",
        applicationResultMemo: applicationResultMemo === undefined ? current?.applicationResultMemo?.trim() || undefined : applicationResultMemo.trim(),
        memo: memo.trim() || undefined,
        noticeDocumentChecked: checklist.noticeDocumentChecked ?? current?.noticeDocumentChecked ?? false,
        eligibilityChecked: checklist.eligibilityChecked ?? current?.eligibilityChecked ?? false,
        scheduleChecked: checklist.scheduleChecked ?? current?.scheduleChecked ?? false,
        fundsChecked: checklist.fundsChecked ?? current?.fundsChecked ?? false,
      });
      if (epoch !== memberScope.current) return;
      setFavoriteTrackers((current) => new Map(current).set(noticeId, tracker));
      setToast(progress === "APPLIED" && applicationResult ? "신청 결과를 저장했습니다." : "관심청약 준비 상태를 저장했습니다.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setToast(error instanceof Error ? error.message : "준비 상태를 저장하지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setFavoriteTrackerPendingId(undefined);
    }
  };

  const synchronizeMemberLists = async (profile: MemberProfile, epoch: number) => {
    setMember(profile);
    let synchronized = true;
    try {
      const guestIds = [...savedIds];
      const accountIds = guestIds.length > 0 ? await mergeFavoriteIds(guestIds) : await fetchFavoriteIds();
      if (epoch !== memberScope.current) return false;
      setSavedIds(new Set(accountIds));
      const trackers = await fetchFavoriteTrackers();
      if (epoch !== memberScope.current) return false;
      setFavoriteTrackers(new Map(trackers.map((tracker) => [tracker.noticeId, tracker])));
      window.localStorage.removeItem("cheongyak-one-saved");
    } catch {
      synchronized = false;
    }
    if (epoch !== memberScope.current) return false;
    try {
      const browserIds = comparisonIds;
      const accountIds = browserIds.length > 0
        ? await mergeComparisonIds(browserIds)
        : await fetchComparisonIds();
      if (epoch !== memberScope.current) return false;
      setComparisonIds(accountIds);
      window.localStorage.removeItem("cheongyak-one-comparison");
    } catch {
      synchronized = false;
    }
    return synchronized;
  };

  const handleLogin = async (email: string, password: string) => {
    const epoch = ++memberScope.current;
    const profile = await loginMember(email, password);
    if (epoch !== memberScope.current) return;
    const synchronized = await synchronizeMemberLists(profile, epoch);
    if (epoch !== memberScope.current) return;
    let preferenceApplied = false;
    let defaultProfileApplied = false;
    try {
      const preference = await fetchSearchPreference();
      if (epoch !== memberScope.current) return;
      setSearchPreference(preference);
      if (preference) {
        applySearchPreference(preference);
        preferenceApplied = true;
      }
    } catch {
      // 로그인은 유지하고 검색조건만 사용자가 다시 불러올 수 있게 한다.
    }
    if (epoch !== memberScope.current) return;
    try {
      const profiles = await fetchSavedSearchProfiles();
      if (epoch !== memberScope.current) return;
      // 로그인 동작에서도 기본 프로필을 즉시 반영해 새로고침 없이 동일한 시작 조건을 제공한다.
      const defaultProfile = profiles.find((item) => item.defaultProfile);
      if (defaultProfile) {
        applySearchPreference(defaultProfile);
        defaultProfileApplied = true;
      }
    } catch {
      // 로그인은 유지하고 저장 프로필은 필터에서 다시 불러올 수 있게 한다.
    }
    if (epoch !== memberScope.current) return;
    try {
      const eligibility = await fetchEligibilityProfile();
      if (epoch !== memberScope.current) return;
      setEligibilityProfile(eligibility);
    } catch {
      // 로그인은 유지하고 사전점검은 사용자가 다시 시작할 수 있게 한다.
    }
    if (epoch !== memberScope.current) return;
    setMemberDialog(null);
    setToast(synchronized
      ? defaultProfileApplied
        ? "로그인하고 기본 저장 조건을 적용했어요."
        : preferenceApplied
        ? "로그인하고 저장된 맞춤 검색조건을 적용했어요."
        : "로그인했습니다. 관심·비교 목록을 계정과 동기화했어요."
      : "로그인은 완료됐지만 목록 동기화는 다시 시도해야 합니다.");
  };

  const handleSignup = async (email: string, password: string, profileInput: MemberProfileInput) => {
    const profile = await signupMember(email, password, profileInput);
    if (profile.emailVerified) {
      await handleLogin(email, password);
      return;
    }
    setMemberDialog("verify-email");
    setToast("가입했습니다. 이메일의 인증 링크를 확인해주세요.");
  };

  const handleRequestEmailVerification = async (email: string) => {
    await requestEmailVerification(email);
  };

  const handleRequestPasswordReset = async (email: string) => {
    await requestPasswordReset(email);
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!passwordResetToken) throw new Error("비밀번호 재설정 링크를 다시 열어주세요.");
    await resetPasswordWithToken(passwordResetToken, newPassword);
    setPasswordResetToken("");
    setMemberDialog("login");
    setToast("비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.");
  };

  const clearMemberSession = (guestIds = new Set<number>()) => {
    ++memberScope.current;
    setMember(undefined);
    setAuthLoading(false);
    setFavoriteTrackers(new Map());
    setFavoritePendingId(undefined);
    setFavoriteTrackerPendingId(undefined);
    setComparisonPendingId(undefined);
    setComparisonResetPending(false);
    setPreferenceBusy(false);
    setEligibilityBusy(false);
    setNotificationsOpen(false);
    setAdminSyncOpen(false);
    setSearchPreference(undefined);
    setEligibilityProfile(undefined);
    setQualOpen(false);
    setAnswers([]);
    setQualStep(0);
    setSavedIds(guestIds);
    setSavedOnly(false);
    setComparisonIds([]);
    setComparisonOpen(false);
    setMemberDialog(null);
  };

  const handleLogout = async () => {
    const epoch = memberScope.current;
    await logoutMember();
    if (epoch !== memberScope.current) return;
    clearMemberSession(readGuestSavedIds());
    setToast("로그아웃했습니다.");
  };

  const handleUpdateProfile = async (profileInput: MemberProfileInput) => {
    const epoch = memberScope.current;
    const profile = await updateMemberProfile(profileInput);
    if (epoch === memberScope.current) setMember(profile);
  };

  const handleDeletePersonalProfile = async () => {
    const epoch = memberScope.current;
    const profile = await deleteMemberPersonalProfile();
    if (epoch === memberScope.current) setMember(profile);
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const epoch = memberScope.current;
    await changeMemberPassword(currentPassword, newPassword);
    if (epoch !== memberScope.current) return;
    clearMemberSession();
    setToast("비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.");
  };

  const handleWithdraw = async (password: string) => {
    const epoch = memberScope.current;
    await withdrawMember(password);
    if (epoch !== memberScope.current) return;
    clearMemberSession();
    setToast("회원 탈퇴가 완료됐습니다.");
  };

  const handleSaveSearchPreference = async () => {
    if (!member) {
      setFilterOpen(false);
      setMemberDialog("login");
      setToast("맞춤 검색조건을 저장하려면 로그인해주세요.");
      return;
    }
    setPreferenceBusy(true);
    const epoch = memberScope.current;
    try {
      const preference = await saveSearchPreference({
        region: region === "전체" ? undefined : region,
        housingCategory: category === "전체" ? undefined : categoryValue(category),
        supplyType,
        status: activeStatus.toUpperCase() as MemberSearchPreference["status"],
        sort: sortKey,
        minPriceManwon: priceInManwon(minPriceManwon),
        maxPriceManwon: priceInManwon(maxPriceManwon),
        minArea: priceInManwon(minArea),
        maxArea: priceInManwon(maxArea),
      });
      if (epoch !== memberScope.current) return;
      setSearchPreference(preference);
      setToast("현재 검색조건을 계정에 저장했습니다.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setToast(error instanceof Error ? error.message : "검색조건을 저장하지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setPreferenceBusy(false);
    }
  };

  const handleDeleteSearchPreference = async () => {
    setPreferenceBusy(true);
    const epoch = memberScope.current;
    try {
      await deleteSearchPreference();
      if (epoch !== memberScope.current) return;
      setSearchPreference(undefined);
      setToast("저장된 맞춤 검색조건을 삭제했습니다.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setToast(error instanceof Error ? error.message : "검색조건을 삭제하지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setPreferenceBusy(false);
    }
  };

  const currentSearchInput = (): SearchPreferenceInput => ({
    region: region === "전체" ? undefined : region,
    housingCategory: category === "전체" ? undefined : categoryValue(category),
    supplyType,
    status: activeStatus.toUpperCase() as SearchPreferenceInput["status"],
    sort: sortKey,
    minPriceManwon: priceInManwon(minPriceManwon),
    maxPriceManwon: priceInManwon(maxPriceManwon),
    minArea: priceInManwon(minArea),
    maxArea: priceInManwon(maxArea),
  });

  const openSavedSearchProfileEditor = (profile: SavedSearchProfile) => {
    if (preferenceBusy || profilesState.locked) return;
    ++profileEditorEpoch.current; setProfileEditorError("");
    setSavedSearchProfileName(profile.name);
    setSavedSearchProfileDraft({ region: profile.region, housingCategory: profile.housingCategory, supplyType: profile.supplyType, status: profile.status, sort: profile.sort, minPriceManwon: profile.minPriceManwon, maxPriceManwon: profile.maxPriceManwon, minArea: profile.minArea, maxArea: profile.maxArea });
    setEditingSavedSearchProfile(profile);
  };

  const handleUpdateSavedSearchProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const profile = editingSavedSearchProfile;
    const name = savedSearchProfileName.trim();
    const validation = savedProfileInputError(name, savedSearchProfileDraft);
    setProfileEditorError(validation);
    if (!profile || validation || preferenceBusy) return;
    const epoch = profileEditorEpoch.current;
    const updated = await profilesState.mutate(() => updateSavedSearchProfile(profile.id, { name, ...savedSearchProfileDraft }), "저장 조건을 수정했습니다.");
    if (updated && epoch === profileEditorEpoch.current) {
      setEditingSavedSearchProfile(undefined);
    }
  };

  const toggleComparison = async (id: number) => {
    if (comparisonPendingId !== undefined || comparisonResetPending) return;
    const update = updateComparison(comparisonIds, id);
    if (update.limitReached) {
      setToast("공고는 최대 3개까지 비교할 수 있어요.");
      return;
    }
    setComparisonIds(update.ids);
    if (!member) {
      setToast(update.added ? "비교 목록에 담았어요." : "비교 목록에서 뺐어요.");
      return;
    }
    setComparisonPendingId(id);
    const epoch = memberScope.current;
    try {
      const ids = await setComparison(id, update.added);
      if (epoch !== memberScope.current) return;
      setComparisonIds(ids);
      setToast(update.added ? "계정 비교 목록에 담았어요." : "비교 목록에서 뺐어요.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setComparisonIds(comparisonIds);
      setToast(error instanceof Error ? error.message : "비교 목록을 변경하지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setComparisonPendingId(undefined);
    }
  };

  const resetComparisons = async () => {
    if (comparisonResetPending || comparisonPendingId !== undefined) return;
    const previousIds = comparisonIds;
    setComparisonIds([]);
    if (!member) return;
    setComparisonResetPending(true);
    const epoch = memberScope.current;
    try {
      const ids = await clearComparisons();
      if (epoch !== memberScope.current) return;
      setComparisonIds(ids);
      setToast("계정 비교 목록을 모두 비웠어요.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setComparisonIds(previousIds);
      setToast(error instanceof Error ? error.message : "비교 목록을 비우지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setComparisonResetPending(false);
    }
  };

  const openComparison = () => {
    if (comparisonNotices.length < 2) {
      setToast("비교할 공고를 2개 이상 담아주세요.");
      return;
    }
    setComparisonOpen(true);
  };

  const downloadCalendar = (items: NoticeSummary[], filename: string) => {
    const hasSchedule = items.some((item) => item.applyStartDate || item.applyEndDate || item.winnerAnnounceDate);
    if (!hasSchedule) {
      setToast("저장할 청약 일정이 아직 없어요.");
      return;
    }

    // 브라우저에서 표준 ICS 파일을 생성해 별도 개인정보 전송 없이 저장한다.
    const url = URL.createObjectURL(new Blob([buildNoticeCalendar(items)], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setToast("캘린더 파일을 저장했어요.");
  };

  const downloadFavoriteResults = () => {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = savedNotices.map((item) => {
      const tracker = favoriteTrackers.get(item.id);
      return [item.title, item.region, item.applyEndDate ?? "", item.winnerAnnounceDate ?? "", FAVORITE_PROGRESS_LABELS[tracker?.progress ?? "SAVED"], `${completedChecklistCount(tracker)}/4`, tracker?.memo ?? "", tracker?.progress === "APPLIED" ? FAVORITE_APPLICATION_RESULT_LABELS[tracker.applicationResult ?? "PENDING"] : "", tracker?.applicationResultRecordedAt ?? "", tracker?.applicationResultMemo ?? "", item.officialUrl ?? ""];
    });
    const content = ["공고명,지역,접수마감일,당첨발표일,준비상태,체크리스트,관심메모,신청결과,결과기록시각,결과메모,공식공고URL", ...rows.map((row) => row.map(escape).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "cheongyak-favorite-results.csv"; anchor.click(); URL.revokeObjectURL(url);
  };

  const searchShareScope = JSON.stringify([query, activeStatus, includeClosed, region, category, supplyType, minPriceManwon, maxPriceManwon, minArea, maxArea, sortKey, savedOnly, member?.id]);
  const searchCopy = useLinkCopy(searchShareScope);
  const noticeCopy = useLinkCopy(JSON.stringify([selected?.id, member?.id]));
  const comparisonCopy = useLinkCopy(JSON.stringify([comparisonOpen, comparisonIds, member?.id]));
  const copyComparisonLink = () => comparisonCopy.copy(publicShareUrl(window.location.href, "comparison", comparisonIds), "비교 링크를 복사했어요.");
  const copyNoticeLink = (noticeId: number) => noticeCopy.copy(publicShareUrl(window.location.href, "notice", [noticeId]), "공고 링크를 복사했어요.");
  const copySearchLink = () => searchCopy.copy(publicShareUrl(noticeSearchUrl(window.location.href, {
    query, status: activeStatus, includeClosed, region: region === "전체" ? undefined : region,
    category: categoryValue(category), supplyType, minPriceManwon: priceInManwon(minPriceManwon),
    maxPriceManwon: priceInManwon(maxPriceManwon), minArea: priceInManwon(minArea), maxArea: priceInManwon(maxArea), sort: sortKey,
  }), "search"), "현재 검색조건 링크를 복사했어요.");

  const applyQuickFilter = (value: string) => {
    setSavedOnly(false);
    setActiveStatus("all");
    setIncludeClosed(false);
    resetVisible();
    if (REGION_ORDER.includes(value)) {
      setRegion(value);
      setCategory("전체");
      setSupplyType(undefined);
      rememberSearch({ query: "", status: "all", region: value, includeClosed: false, sort: sortKey });
    } else {
      setCategory(value);
      setRegion("전체");
      setSupplyType(undefined);
      rememberSearch({ query: "", status: "all", category: categoryValue(value), includeClosed: false, sort: sortKey });
    }
    scrollToResults();
  };

  const openReadyFavorites = () => {
    setSavedOnly(true);
    setFavoriteProgressFilter("READY");
    setActiveStatus("all");
    resetVisible();
    scrollToResults();
  };

  const openDetail = async (item: Application) => {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    const targetUrl = noticeUrl(window.location.href, item.id);
    if (noticeIdFromSearch(window.location.search) !== item.id) {
      window.history.pushState({ ...window.history.state, cheongyakNoticeModal: true }, "", targetUrl);
    }
    setSelected(item);
    setSelectedDetail(null);
    setSelectedChanges([]);
    setDetailError("");
    setDetailLoading(true);
    try {
      const detail = await fetchNotice(item.id, controller.signal);
      if (controller.signal.aborted || detailRequest.current !== controller) return;
      setSelectedDetail(detail);
      rememberNotice(detail.id);
    } catch (error) {
      if (controller.signal.aborted || detailRequest.current !== controller) return;
      setDetailError(error instanceof Error ? error.message : "상세 정보를 불러오지 못했습니다.");
    } finally {
      if (!controller.signal.aborted && detailRequest.current === controller) setDetailLoading(false);
    }
  };

  const openNotificationNotice = async (noticeId: number) => {
    setNotificationsOpen(false);
    const application = applications.find((item) => item.id === noticeId);
    if (application) {
      await openDetail(application);
      return;
    }
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    try {
      window.history.pushState(
        { ...window.history.state, cheongyakNoticeModal: true },
        "",
        noticeUrl(window.location.href, noticeId),
      );
      const detail = await fetchNotice(noticeId, controller.signal);
      if (controller.signal.aborted || detailRequest.current !== controller) return;
      setSelected(toApplication(detail));
      setSelectedDetail(detail);
      rememberNotice(detail.id);
    } catch (error) {
      if (controller.signal.aborted || detailRequest.current !== controller) return;
      window.history.replaceState(window.history.state, "", noticeUrl(window.location.href));
      clearDetail();
      setToast(error instanceof Error ? error.message : "알림의 공고를 불러오지 못했습니다.");
    }
  };

  const answerQuestion = (answer: EligibilityAnswer) => {
    setAnswers((items) => [...items, answer]);
    setQualStep((step) => step + 1);
  };

  const openQualification = (saved = false) => {
    if (!member) {
      setMemberDialog("login");
      setToast("청약 조건 사전점검은 로그인 후 저장하고 관리할 수 있어요.");
      return;
    }
    if (saved && eligibilityProfile) {
      setAnswers([
        eligibilityProfile.homeless,
        eligibilityProfile.subscriptionAccount,
        eligibilityProfile.newlywed,
        eligibilityProfile.firstHome,
      ]);
      setQualStep(eligibilityQuestions.length);
    } else {
      setAnswers([]);
      setQualStep(0);
    }
    setQualOpen(true);
  };

  const handleSaveEligibilityProfile = async () => {
    if (answers.length !== eligibilityQuestions.length) return;
    setEligibilityBusy(true);
    const epoch = memberScope.current;
    try {
      const saved = await saveEligibilityProfile({
        homeless: answers[0],
        subscriptionAccount: answers[1],
        newlywed: answers[2],
        firstHome: answers[3],
      });
      if (epoch !== memberScope.current) return;
      setEligibilityProfile(saved);
      setToast(eligibilityProfile ? "사전점검 답변을 수정했습니다." : "사전점검 답변을 저장했습니다.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setToast(error instanceof Error ? error.message : "사전점검을 저장하지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setEligibilityBusy(false);
    }
  };

  const handleDeleteEligibilityProfile = async () => {
    setEligibilityBusy(true);
    const epoch = memberScope.current;
    try {
      await deleteEligibilityProfile();
      if (epoch !== memberScope.current) return;
      setEligibilityProfile(undefined);
      closeQualification();
      setToast("저장된 사전점검을 삭제했습니다.");
    } catch (error) {
      if (epoch !== memberScope.current) return;
      setToast(error instanceof Error ? error.message : "사전점검을 삭제하지 못했습니다.");
    } finally {
      if (epoch === memberScope.current) setEligibilityBusy(false);
    }
  };

  const closeQualification = () => {
    setQualOpen(false);
    window.setTimeout(() => { setQualStep(0); setAnswers([]); }, 200);
  };

  const detailApplication = selected ? (selectedDetail ? toApplication(selectedDetail) : selected) : null;
  const detailUnitRange = {
    minPrice: priceInWon(minPriceManwon), maxPrice: priceInWon(maxPriceManwon),
    minArea: priceInManwon(minArea), maxArea: priceInManwon(maxArea),
  };
  const filterDialogRef = useDialogAccessibility<HTMLElement>(filterOpen, () => setFilterOpen(false));
  const closeProfileEditor = () => { ++profileEditorEpoch.current; setEditingSavedSearchProfile(undefined); setProfileEditorError(""); };
  const savedSearchProfileEditorRef = useDialogAccessibility<HTMLElement>(Boolean(editingSavedSearchProfile), closeProfileEditor);
  const comparisonDialogRef = useDialogAccessibility<HTMLElement>(comparisonOpen, () => setComparisonOpen(false));
  const qualificationDialogRef = useDialogAccessibility<HTMLElement>(qualOpen, closeQualification);
  const eligibilityResult = buildEligibilityCheckResult(answers);

  return (
    <main>
      {!online && <section className="connection-banner" role="status" aria-label="오프라인 안내">
        <strong>인터넷 연결이 끊겼어요.</strong>
        <p>목록 자동 재시도를 잠시 멈췄습니다. 연결되면 현재 검색조건으로 다시 불러옵니다.</p>
        <small>표시된 공고는 마지막으로 불러온 목록입니다. 변경한 검색조건은 재연결 후 적용되며 최신 정보가 아닐 수 있습니다.</small>
      </section>}
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="청약한눈 홈">
            <img className="brand-mark" src="/brand/logo.png" alt="" />
            <span>청약한눈</span>
          </a>
          <nav className="main-nav" aria-label="주요 메뉴">
            <a className="active" href="#applications">청약 찾기</a>
            <a href="#schedule">청약 일정</a>
            <a href="#guide">자격 가이드</a>
          </nav>
          <div className="header-actions">
            <span className="demo-chip live-chip">LIVE DATA</span>
            <button
              className={`saved-button ${savedOnly ? "active" : ""}`}
              aria-label={`관심청약 ${savedIds.size}개`}
              type="button"
              onClick={() => { setSavedOnly((value) => !value); setFavoriteProgressFilter("ALL"); setActiveStatus("all"); resetVisible(); scrollToResults(); }}
              aria-pressed={savedOnly}
            >
              <Icon name="bookmark" /> <span>관심청약</span> <b>{savedIds.size}</b>
            </button>
            {member && favoritePreparation.counts.READY > 0 && <button className="ready-favorites-button" type="button" aria-label={`신청 준비 ${favoritePreparation.counts.READY}개`} onClick={openReadyFavorites}><Icon name="check" /> <span>신청 준비</span> <b>{favoritePreparation.counts.READY}</b></button>}
            {member && (
              <button className="notification-button" type="button" onClick={() => { setMemberDialog(null); setNotificationsOpen(true); }} aria-label={`알림 ${unreadNotificationCount}개`}>
                <Icon name="bell" />
                {unreadNotificationCount > 0 && <b>{Math.min(unreadNotificationCount, 99)}</b>}
              </button>
            )}
            {member?.role === "ADMIN" && (
              <button className="admin-button" type="button" aria-label="운영 관리" onClick={() => { setMemberDialog(null); setNotificationsOpen(false); setAdminSyncOpen(true); }}>
                <Icon name="grid" /> <span>운영 관리</span>
              </button>
            )}
            <button
              className={`account-button ${member ? "signed-in" : ""}`}
              aria-label={authLoading ? "회원 확인 중" : member ? member.nickname : "로그인"}
              type="button"
              onClick={() => { setNotificationsOpen(false); setMemberDialog(member ? "account" : "login"); }}
              disabled={authLoading}
            >
              <Icon name="user" /> <span>{authLoading ? "확인 중" : member ? member.nickname : "로그인"}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span></span> 매일 업데이트되는 청약 정보</div>
          <h1>내 조건에 맞는 청약만,<br/><em>한눈에.</em></h1>
          <p>흩어진 모집공고를 일일이 찾지 마세요.<br/>청약홈 공고를 지역과 일정별로 보기 쉽게 정리해드려요.</p>
          <form className="search-box" role="search" onSubmit={submitSearch}>
            <label className="search-field">
              <Icon name="search" />
              <input value={query} maxLength={100} onChange={(event) => { setQuery(event.target.value); resetVisible(); }} placeholder="지역 또는 단지명을 검색해보세요" aria-label="청약 검색어" />
              {query && <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><Icon name="close" /></button>}
            </label>
            <button className="search-submit" type="submit">청약 찾기 <Icon name="arrow" /></button>
          </form>
          <div className="quick-filters">
            <span>빠른 검색</span>
            {["서울", "경기", "아파트", "오피스텔"].map((item) => <button type="button" key={item} onClick={() => applyQuickFilter(item)}>{item}</button>)}
          </div>
          {recentSearches.length > 0 && (
            <div className="recent-searches" aria-label="최근 검색">
              <span>최근 검색</span>
              {recentSearches.map((item) => <div className="recent-search-entry" key={`${item.usedAt}-${noticeSearchUrl("https://search.invalid/", item.state)}`}>
                <button type="button" title={recentSearchLabel(item.state)} aria-label={`최근 검색 적용: ${recentSearchLabel(item.state)}`} onClick={() => applyRecentSearch(item.state)}>{recentSearchLabel(item.state)}</button>
                <button type="button" aria-label={`최근 검색 삭제: ${recentSearchLabel(item.state)}`} onClick={() => deleteRecentSearch(item)}>×</button>
              </div>)}
              <button className="recent-searches-clear" type="button" onClick={clearRecentSearches}>지우기</button>
            </div>
          )}
        </div>

        <aside className="week-card" aria-label="이번 주 청약 요약">
          <div className="week-card-head">
            <div><span className="mini-label">{thisMonth}월 {Math.ceil(thisDay / 7)}주차</span><h2>이번 주 청약</h2></div>
            <span className="live-dot">LIVE</span>
          </div>
          <div className="week-stats">
            <div><strong>{facetsUnavailable ? "–" : openCount}</strong><span>접수중</span></div>
            <div><strong>{facetsUnavailable ? "–" : todayCount}</strong><span>오늘 마감</span></div>
            <div><strong>{facetsUnavailable ? "–" : upcomingCount}</strong><span>오픈 예정</span></div>
          </div>
          {highlight && highlightEvent ? (
            <button className="next-event" type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); void openDetail(highlight); }}>
              <span className="date-box"><strong>{Number(highlightEvent.date.slice(8))}</strong><span>{weekday(highlightEvent.date)}</span></span>
              <span><small>{highlightEvent.label}</small><b>{highlight.title}</b></span>
              <Icon name="arrow" />
            </button>
          ) : (
            <div className="next-event no-event"><span>새로운 접수 일정을 확인 중입니다.</span></div>
          )}
          <p className={`data-note ${noticeFreshness?.status === "DELAYED" ? "delayed" : ""}`}>공개 공고 데이터 · {dataFreshnessMessage}</p>
          <SourceFreshnessPanel sources={noticeFreshness?.sources} />
        </aside>
      </section>

      <section className="dashboard" id="applications" tabIndex={-1} aria-label="청약 검색 결과">
        <div className="status-tabs" role="tablist" aria-label="청약 상태" {...statusTabProps}>
          {statuses.map((status) => (
            <button className={activeStatus === status.key ? "selected" : ""} type="button" role="tab" aria-selected={activeStatus === status.key} key={status.key} onClick={() => { setActiveStatus(status.key); if (status.key !== "all") setIncludeClosed(false); setSavedOnly(false); setFavoriteProgressFilter("ALL"); resetVisible(); }}>
              <span className={`tab-icon ${status.tone}`} aria-hidden="true"><Icon name={status.icon} /></span><span><span className="status-tab-label">{status.label}</span><b>{facetsUnavailable ? "–" : status.count}</b></span>
            </button>
          ))}
        </div>

        {facetsError && <div className="facets-error" role="status">
          <span>청약 건수를 불러오지 못했어요. 공고 목록은 계속 확인할 수 있어요.</span>
          <button type="button" onClick={() => setFacetsVersion((version) => version + 1)}>건수 다시 불러오기</button>
        </div>}

        <div className="content-grid">
          <div className="list-panel">
            <div className="section-head">
              <div>
                <span className="section-kicker">{savedOnly ? "MY SAVED" : "REAL-TIME NOTICES"}</span>
                <h2>{savedOnly ? "관심 청약" : "지금 확인할 청약"}</h2>
                <p className="result-summary" aria-live="polite">{loading ? "실제 공고를 불러오는 중" : `${includeClosed && activeStatus === "all" ? "마감 공고를 포함한" : "조건에 맞는"} 공고 ${savedOnly && favoriteProgressFilter !== "ALL" ? visible.length : noticeTotal}건`}</p>
              </div>
              <div className="section-actions">
                <label className="sort-control">
                  <span>정렬</span>
                  {savedOnly ? (
                    <select value={favoriteSortKey} onChange={(event) => setFavoriteSortKey(event.target.value as FavoriteSortKey)} aria-label="관심청약 정렬">
                      <option value="PREPARATION">준비 상태순</option>
                      <option value="DEADLINE">마감 임박순</option>
                      <option value="RESULT">신청 결과순</option>
                    </select>
                  ) : (
                    <select value={sortKey} onChange={(event) => { setSortKey(event.target.value as NoticeSortKey); resetVisible(); }} aria-label="청약 공고 정렬">
                      <option value="LATEST">최신 공고순</option>
                      <option value="DEADLINE">마감 임박순</option>
                      <option value="APPLY_START">접수 시작일순</option>
                      <option value="WINNER_ANNOUNCEMENT">당첨 발표일순</option>
                      <option value="PRICE_ASC">낮은 분양가순</option>
                      <option value="SUPPLY_DESC">공급 세대 많은순</option>
                    </select>
                  )}
                </label>
                {!savedOnly && <button className={`closed-notice-toggle ${includeClosed ? "selected" : ""}`} type="button" onClick={() => { setIncludeClosed((value) => !value); setActiveStatus("all"); resetVisible(); }} aria-pressed={includeClosed}>마감 공고 포함</button>}
                {savedOnly && savedNotices.length > 0 && <button className="calendar-button" type="button" onClick={() => downloadCalendar(savedNotices, "cheongyak-saved.ics")}><Icon name="calendar" /> 관심 일정 저장</button>}
                {savedOnly && savedNotices.length > 0 && <button className="calendar-button" type="button" onClick={() => setFavoriteCalendarOpen(true)}><Icon name="calendar" /> 전체 일정 보기</button>}
                {savedOnly && member && savedNotices.length > 0 && <button className="calendar-button" type="button" onClick={downloadFavoriteResults}>내 기록 CSV</button>}
                <button className="search-share-button" type="button" disabled={searchCopy.busy} onClick={() => void copySearchLink()}><Icon name="arrow" /> 검색 공유</button>
                <button className="filter-button" type="button" onClick={() => setFilterOpen(true)} disabled={loading} aria-label={`청약 필터 열기${activeFilterCount > 0 ? ` ${activeFilterCount}개 적용됨` : ""}`}><Icon name="filter" /> 지역·유형·예산 필터 {activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
              </div>
            </div>
            <LinkCopyFeedback state={searchCopy} />
            {!savedOnly && activeFilterLabels.length > 0 && <p className="active-filter-summary" aria-live="polite">적용 중: {activeFilterLabels.join(" · ")}</p>}
            {!savedOnly && removableConditions.length > 0 && (
              <div className="filter-removal-controls" role="group" aria-label="검색 조건 해제">
                {removableConditions.map(condition => <button key={condition.key} type="button" aria-label={`${condition.label} 조건 해제`} onClick={() => {
                  document.getElementById("applications")?.focus({ preventScroll: true });
                  const before = currentSearchState();
                  setSearchUndo({ before, after: { ...before, ...conditionResets[condition.key] } });
                  condition.clear(); resetVisible();
                }}>{condition.label} ×</button>)}
                <button type="button" onClick={() => {
                  document.getElementById("applications")?.focus({ preventScroll: true });
                  resetSearchConditions();
                }}>검색 조건 전체 초기화</button>
              </div>
            )}
            {!savedOnly && searchUndo && (
              <div className="search-undo">
                <p role="status">검색 조건을 해제했습니다. 직전 조건으로 되돌릴 수 있습니다.</p>
                <button type="button" onClick={() => {
                  const previous = searchUndo.before;
                  setSearchUndo(undefined);
                  applyRecentSearch(previous, false);
                }}>검색 조건 되돌리기</button>
                <button type="button" aria-label="검색 조건 복원 안내 닫기" onClick={() => {
                  document.getElementById("applications")?.focus({ preventScroll: true });
                  setSearchUndo(undefined);
                }}>닫기</button>
              </div>
            )}

            {loadRetryPending && (
              <div className="notice-load-status" role="status">
                <p>{loadError}</p>
                <small>첫 연결에는 시간이 걸릴 수 있어요. 약 5분 동안 자동으로 다시 시도합니다.</small>
                <button type="button" onClick={retryNoticeLoad} disabled={!online}>지금 다시 시도</button>
              </div>
            )}
            {loadError && cachedListShownAt && !loadRetryPending && (
              <div className="notice-load-status" role="status">
                <p>최신 공고를 확인하지 못했어요. 이전에 불러온 목록을 표시합니다.</p>
                <button type="button" onClick={retryNoticeLoad} disabled={!online}>다시 불러오기</button>
              </div>
            )}
            {!online && visible.length === 0 ? (
              <div className="notice-load-status" role="status"><p>연결 후 현재 검색조건의 공고를 확인할 수 있습니다.</p></div>
            ) : (loading || loadRetryPending) && !cachedListShownAt ? (
              <div className="list-loading" role="status" aria-label="청약 공고 불러오는 중">
                {[0, 1, 2].map((item) => <div className="list-skeleton" key={item}><i></i><strong></strong><span></span><small></small></div>)}
              </div>
            ) : loadError && !cachedListShownAt ? (
              <div className="inline-error" role="alert">
                <span>!</span><h3>공고를 불러오지 못했어요</h3><p>{loadError}</p>
                <button type="button" onClick={retryNoticeLoad} disabled={!online}>다시 불러오기</button>
              </div>
            ) : visible.length > 0 ? (
              <>
                {savedOnly && member && (
                  <section className="favorite-preparation-summary" aria-label="관심청약 준비 현황">
                    <div className="favorite-summary-heading">
                      <span>준비 현황</span>
                      <strong>신청 완료 건은 아래로, 마감이 가까운 공고는 먼저 확인하세요.</strong>
                    </div>
                    <div className="favorite-summary-stats">
                      <span><b>{favoritePreparation.counts.CHECKING}</b> 조건 확인 중</span>
                      <span><b>{favoritePreparation.counts.READY}</b> 신청 준비 완료</span>
                      <span><b>{favoritePreparation.counts.APPLIED}</b> 신청 완료</span>
                      {favoritePreparation.counts.APPLIED > 0 && <em>당첨 {favoritePreparation.applicationResults.SELECTED} · 예비 {favoritePreparation.applicationResults.WAITLISTED} · 발표 대기 {favoritePreparation.applicationResults.PENDING}</em>}
                      {favoritePreparation.resultDue > 0 && <em className="result-due-stat">발표 확인 필요 {favoritePreparation.resultDue}건</em>}
                      {favoritePreparation.recordedResults > 0 && <em>결과 기록 완료 {favoritePreparation.recordedResults}건</em>}
                      {favoritePreparation.checklistIncomplete > 0 && <em>확인 항목 남음 {favoritePreparation.checklistIncomplete}건</em>}
                      {favoritePreparation.urgent > 0 && <em>마감 3일 이내 {favoritePreparation.urgent}건</em>}
                    </div>
                    <div className="favorite-eligibility-status">
                      <div>
                        <span>내 청약 조건 사전점검</span>
                        <strong>{eligibilityProfile ? "저장된 내 조건을 기준으로 공고문을 확인하세요" : "사전점검을 저장하면 준비 항목을 더 빠르게 확인할 수 있어요"}</strong>
                      </div>
                      <button type="button" onClick={() => openQualification(Boolean(eligibilityProfile))}>{eligibilityProfile ? "조회·수정" : "사전점검 시작"}</button>
                    </div>
                    <div className="favorite-progress-filters" role="group" aria-label="관심청약 준비 상태 필터">
                      {(["ALL", "INCOMPLETE", "CHECKING", "READY", "APPLIED"] as const).map((progress) => (
                        <button className={favoriteProgressFilter === progress ? "active" : ""} type="button" key={progress} onClick={() => setFavoriteProgressFilter(progress)}>
                          {progress === "ALL" ? `전체 ${savedIds.size}` : progress === "INCOMPLETE" ? `확인 필요 ${favoritePreparation.checklistIncomplete}` : `${FAVORITE_PROGRESS_LABELS[progress]} ${favoritePreparation.counts[progress]}`}
                        </button>
                      ))}
                      <button className={favoriteProgressFilter === "URGENT" ? "active urgent-filter" : "urgent-filter"} type="button" onClick={() => setFavoriteProgressFilter("URGENT")} disabled={favoritePreparation.urgent === 0}>마감 임박 {favoritePreparation.urgent}</button>
                      <button className={favoriteProgressFilter === "RESULT_DUE" ? "active result-due-filter" : "result-due-filter"} type="button" onClick={() => setFavoriteProgressFilter("RESULT_DUE")} disabled={favoritePreparation.resultDue === 0}>발표 확인 {favoritePreparation.resultDue}</button>
                      {(["PENDING", "SELECTED", "WAITLISTED", "NOT_SELECTED"] as FavoriteApplicationResult[]).map((result) => {
                        const filter = `RESULT_${result}` as FavoriteProgressFilter;
                        return <button className={favoriteProgressFilter === filter ? "active result-filter" : "result-filter"} type="button" key={filter} onClick={() => setFavoriteProgressFilter(filter)} disabled={favoritePreparation.applicationResults[result] === 0}>
                          {FAVORITE_APPLICATION_RESULT_LABELS[result]} {favoritePreparation.applicationResults[result]}
                        </button>;
                      })}
                    </div>
                    <label className="favorite-search-control">
                      <span>관심청약·메모 검색</span>
                      <input value={favoriteKeyword} maxLength={100} onChange={(event) => setFavoriteKeyword(event.target.value)} placeholder="공고명, 지역, 내 메모" />
                      {favoriteKeyword && <button type="button" onClick={() => setFavoriteKeyword("")}>지우기</button>}
                    </label>
                    {upcomingFavoriteEvents.length > 0 && (
                      <div className="favorite-upcoming-events" aria-label="다가오는 관심청약 일정">
                        <div><span>다가오는 내 일정</span><small>관심청약의 접수·당첨 발표 일정입니다.</small></div>
                        <ol>{upcomingFavoriteEvents.map((event) => <li key={`${event.item.id}-${event.label}-${event.date}`}><time>{formatShortDate(event.date)}</time><span>{event.label}</span><button type="button" onClick={(click) => { click.currentTarget.focus({ preventScroll: true }); void openDetail(event.item); }}>{event.item.title}</button></li>)}</ol>
                      </div>
                    )}
                    {resultDueFavoriteEvents.length > 0 && (
                      <div className="favorite-result-due-events" aria-label="확인이 필요한 당첨 발표">
                        <div><span>당첨 발표 확인</span><small>신청 결과가 아직 기록되지 않은 공고입니다.</small></div>
                        <ol>{resultDueFavoriteEvents.map(({ item, date }) => <li key={item.id}><time>{formatShortDate(date)}</time><span>{resultDueLabel(date)}</span><button type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); void openDetail(item); }}>{item.title}</button></li>)}</ol>
                      </div>
                    )}
                  </section>
                )}
                <div className="application-list">
                  {visible.map((item) => (
                    <article className="application-card" key={item.id} id={`notice-card-${item.id}`} tabIndex={-1} aria-label={item.title}>
                      <div className="card-topline">
                        <div className="tags"><span className={`state ${item.stateTone}`}>{item.state}</span><span className="type-tag">{item.type}</span></div>
                        <button className={`bookmark ${savedIds.has(item.id) ? "saved" : ""}`} type="button" onClick={() => void toggleSaved(item.id)} disabled={favoritePendingId === item.id} aria-label={`${item.title} 관심청약 ${savedIds.has(item.id) ? "해제" : "저장"}`} aria-pressed={savedIds.has(item.id)}><Icon name="bookmark" /></button>
                      </div>
                      <div className="card-main">
                        <div><h3>{item.title}</h3><p className="location"><Icon name="pin" /> {item.location}</p></div>
                        <div className="deadline"><strong>{item.dday}</strong><span>{item.period}</span></div>
                      </div>
                      <div className="card-facts"><span>{item.price}</span><i></i><span>{item.scale}</span><i></i><span>{item.region}</span></div>
                      {savedOnly && member && (
                        <div className="favorite-tracker">
                          <label>준비 상태
                            <select value={favoriteTrackers.get(item.id)?.progress ?? "SAVED"} disabled={favoriteTrackerPendingId === item.id} onChange={(event) => void saveFavoriteTracker(item.id, event.target.value as FavoriteProgress, favoriteTrackers.get(item.id)?.memo ?? "")}>
                              {Object.entries(FAVORITE_PROGRESS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </label>
                          <div className="favorite-memo-field">
                            <label>내 메모
                              <input key={`${item.id}-${favoriteTrackers.get(item.id)?.updatedAt ?? "new"}`} defaultValue={favoriteTrackers.get(item.id)?.memo ?? ""} maxLength={500} placeholder="예: 모집공고문 소득 기준 확인" onBlur={(event) => void saveFavoriteTracker(item.id, favoriteTrackers.get(item.id)?.progress ?? "SAVED", event.target.value)} />
                            </label>
                            {favoriteTrackers.get(item.id)?.memo && <button type="button" disabled={favoriteTrackerPendingId === item.id} onClick={() => void saveFavoriteTracker(item.id, favoriteTrackers.get(item.id)?.progress ?? "SAVED", "")}>메모 삭제</button>}
                          </div>
                          <span className="favorite-checklist-progress">사전 확인 {completedChecklistCount(favoriteTrackers.get(item.id))}/4 · {completedChecklistCount(favoriteTrackers.get(item.id)) * 25}%</span>
                          {completedChecklistCount(favoriteTrackers.get(item.id)) < FAVORITE_CHECKLIST_ITEMS.length && <span className="favorite-checklist-missing">남은 확인: {incompleteChecklistLabels(favoriteTrackers.get(item.id))}</span>}
                          <div className="favorite-checklist-options favorite-checklist-quick" aria-label={`${item.title} 신청 전 확인 항목`}>
                            {FAVORITE_CHECKLIST_ITEMS.map(({ key, label }) => (
                              <label key={key}>
                                <input type="checkbox" checked={favoriteTrackers.get(item.id)?.[key] ?? false} disabled={favoriteTrackerPendingId === item.id} onChange={(event) => void saveFavoriteTracker(item.id, favoriteTrackers.get(item.id)?.progress ?? "SAVED", favoriteTrackers.get(item.id)?.memo ?? "", { [key]: event.target.checked })} />
                                {label}
                              </label>
                            ))}
                          </div>
                          {completedChecklistCount(favoriteTrackers.get(item.id)) > 0 && <button className="favorite-checklist-reset" type="button" disabled={favoriteTrackerPendingId === item.id} onClick={() => void saveFavoriteTracker(item.id, favoriteTrackers.get(item.id)?.progress ?? "SAVED", favoriteTrackers.get(item.id)?.memo ?? "", { noticeDocumentChecked: false, eligibilityChecked: false, scheduleChecked: false, fundsChecked: false })}>체크리스트 모두 해제</button>}
                          {(favoriteTrackers.get(item.id)?.progress ?? "SAVED") !== "READY" && (favoriteTrackers.get(item.id)?.progress ?? "SAVED") !== "APPLIED" && completedChecklistCount(favoriteTrackers.get(item.id)) === FAVORITE_CHECKLIST_ITEMS.length && <button className="favorite-ready-button" type="button" disabled={favoriteTrackerPendingId === item.id} onClick={() => void saveFavoriteTracker(item.id, "READY", favoriteTrackers.get(item.id)?.memo ?? "")}>체크 완료 · 신청 준비로 변경</button>}
                        </div>
                      )}
                      {savedOnly && member && item.officialUrl && <a className="favorite-official-link" href={item.officialUrl} target="_blank" rel="noreferrer">공식 공고 바로 열기 <Icon name="arrow" /></a>}
                      {savedOnly && member && (favoriteTrackers.get(item.id)?.progress ?? "SAVED") === "READY" && (
                        <div className="ready-application-actions">
                          <span><Icon name="check" /> 신청 준비 완료</span>
                          <div>
                            {item.officialUrl ? <a href={item.officialUrl} target="_blank" rel="noreferrer">공식 공고 열기 <Icon name="arrow" /></a> : <button type="button" disabled>공식 링크 확인 중</button>}
                            <button type="button" onClick={() => void saveFavoriteTracker(item.id, "APPLIED", favoriteTrackers.get(item.id)?.memo ?? "")} disabled={favoriteTrackerPendingId === item.id}>신청 완료로 표시</button>
                          </div>
                        </div>
                      )}
                      {savedOnly && member && (favoriteTrackers.get(item.id)?.progress ?? "SAVED") === "APPLIED" && (
                        <div className="application-result-tracker">
                          <span>신청 결과</span>
                          <select value={favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING"} disabled={favoriteTrackerPendingId === item.id} onChange={(event) => void saveFavoriteTracker(item.id, "APPLIED", favoriteTrackers.get(item.id)?.memo ?? "", {}, event.target.value as FavoriteApplicationResult)} aria-label={`${item.title} 신청 결과`}>
                            {Object.entries(FAVORITE_APPLICATION_RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <small>{(favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING") === "PENDING" ? item.winnerAnnounceDate ? `당첨 발표일 ${formatShortDate(item.winnerAnnounceDate)}에 결과를 확인하세요.` : "당첨 발표일은 공식 공고문에서 확인하세요." : `${favoriteTrackers.get(item.id)?.applicationResultRecordedAt ? `${formatChangedAt(favoriteTrackers.get(item.id)?.applicationResultRecordedAt ?? "")}에 기록` : "공식 당첨자 발표를 기준으로 직접 기록한 결과입니다."}`}</small>
                          {(favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING") !== "PENDING" && <input key={`${item.id}-${favoriteTrackers.get(item.id)?.applicationResultRecordedAt ?? "result"}`} defaultValue={favoriteTrackers.get(item.id)?.applicationResultMemo ?? ""} maxLength={500} placeholder="결과 메모 (예: 계약 일정 확인)" onBlur={(event) => void saveFavoriteTracker(item.id, "APPLIED", favoriteTrackers.get(item.id)?.memo ?? "", {}, favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING", event.target.value)} />}
                        </div>
                      )}
                      {savedOnly && member && (favoriteTrackers.get(item.id)?.progress ?? "SAVED") === "APPLIED" && <span className={`application-result-badge result-${favoriteTrackers.get(item.id)?.applicationResult?.toLowerCase() ?? "pending"}`}>{FAVORITE_APPLICATION_RESULT_LABELS[favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING"]}</span>}
                      <div className="card-actions">
                        <button className="detail-link" type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); void openDetail(item); }}>공고 핵심만 보기 <Icon name="arrow" /></button>
                        <button className={`compare-button ${comparisonIds.includes(item.id) ? "selected" : ""}`} type="button" onClick={() => void toggleComparison(item.id)} disabled={comparisonPendingId !== undefined || comparisonResetPending} aria-pressed={comparisonIds.includes(item.id)}><Icon name="grid" /> {comparisonIds.includes(item.id) ? "비교 해제" : "비교 담기"}</button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="pagination-feedback">
                  {moreError && <p role="alert">다음 공고를 불러오지 못했습니다. 현재 목록은 유지됩니다. {moreError}</p>}
                  <p role="status" aria-live="polite" aria-atomic="true">{loadingMore ? "다음 공고를 불러오는 중입니다." : moreMessage}</p>
                  {firstAddedNoticeId && visible.some(item => item.id === firstAddedNoticeId) && <button type="button" onClick={() => document.getElementById(`notice-card-${firstAddedNoticeId}`)?.focus()}>새로 불러온 공고로 이동</button>}
                  {moreEnded && <button type="button" disabled={!online || loading} onClick={retryNoticeLoad}>목록 새로고침</button>}
                  {(notices.length < noticeTotal || moreMessage) && <button className="more-button" type="button" onClick={() => void loadMoreNotices()} disabled={loadingMore || loading || !online || moreEnded || notices.length >= noticeTotal}>{loadingMore ? "불러오는 중" : moreEnded || notices.length >= noticeTotal ? "추가 조회 완료" : moreError ? "다음 공고 다시 불러오기" : `다음 ${Math.min(NOTICE_PAGE_SIZE, noticeTotal - notices.length)}건 더보기`} <Icon name="arrow" /></button>}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><Icon name={savedOnly ? "bookmark" : "search"} /></span>
                <h3>{savedOnly ? favoriteKeyword ? "검색 조건에 맞는 관심청약이 없어요" : favoriteProgressFilter === "ALL" ? "저장한 관심청약이 없어요" : favoriteProgressFilter === "INCOMPLETE" ? "확인 항목이 남은 관심청약이 없어요" : favoriteProgressFilter === "URGENT" ? "마감이 임박한 관심청약이 없어요" : favoriteProgressFilter === "RESULT_DUE" ? "확인이 필요한 당첨 발표가 없어요" : applicationResultFromFilter(favoriteProgressFilter) ? "선택한 신청 결과의 관심청약이 없어요" : "선택한 준비 상태의 관심청약이 없어요" : "조건에 맞는 공고가 없어요"}</h3>
                <p>{savedOnly ? favoriteKeyword ? "공고명·지역 또는 작성한 메모를 바꿔 검색해 보세요." : favoriteProgressFilter === "ALL" ? "관심 있는 공고의 북마크를 눌러 모아보세요." : favoriteProgressFilter === "INCOMPLETE" ? "현재 보이는 관심청약의 체크리스트를 모두 완료했어요." : favoriteProgressFilter === "URGENT" ? "현재 접수 마감 3일 이내인 관심청약이 없습니다." : favoriteProgressFilter === "RESULT_DUE" ? "당첨 발표일이 지난 신청 건의 결과를 모두 기록했어요." : applicationResultFromFilter(favoriteProgressFilter) ? "신청 결과를 기록한 뒤 다시 확인해 보세요." : "다른 준비 상태를 선택하거나 전체 관심청약을 확인해 보세요." : "검색어나 지역·유형 필터를 조금 넓혀보세요."}</p>
                <button type="button" onClick={() => { document.getElementById("applications")?.focus({ preventScroll: true }); if (savedOnly && (favoriteProgressFilter !== "ALL" || favoriteKeyword)) { setFavoriteProgressFilter("ALL"); setFavoriteKeyword(""); return; } resetSearchConditions(); }}>{savedOnly && (favoriteProgressFilter !== "ALL" || favoriteKeyword) ? "전체 관심청약 보기" : "전체 청약 보기"}</button>
              </div>
            )}
          </div>

          <aside className="side-column">
            <RecommendationPanel
              key={member?.id ?? "visitor"}
              signedIn={Boolean(member)}
              {...recommendationState}
              loading={authLoading || recommendationState.loading}
              onLogin={() => setMemberDialog("login")}
              onConfigure={() => setFilterOpen(true)}
              onOpenNotice={(noticeId) => { void openNotificationNotice(noticeId); }}
            />

            <section className="plan-card" id="guide">
              <div className="plan-head">
                <span className="plan-illustration"></span>
                <div><span>신청 전 확인사항 정리</span><h2>청약 조건 사전점검</h2></div>
              </div>
              <p>몇 가지 질문에 답하고 공식 공고문에서 확인할 조건을 정리해보세요.</p>
              <ul><li><Icon name="check" /> 무주택 기간</li><li><Icon name="check" /> 청약통장 조건</li><li><Icon name="check" /> 소득·자산 기준</li></ul>
              {eligibilityProfile && <p className="saved-eligibility-date">최근 저장: {new Date(eligibilityProfile.updatedAt).toLocaleDateString("ko-KR")}</p>}
              <button type="button" onClick={() => openQualification(Boolean(eligibilityProfile))}>
                {eligibilityProfile ? "저장된 점검 조회·수정" : member ? "확인사항 정리하기" : "로그인하고 점검하기"} <Icon name="arrow" />
              </button>
            </section>

            {recentNotices.length > 0 && (
              <section className="recent-card" aria-labelledby="recent-notice-title">
                <div className="side-title"><div><span>RECENT</span><h2 id="recent-notice-title">최근 본 공고</h2></div><button type="button" onClick={clearRecentNotices}>전체 삭제</button></div>
                <ol>
                  {recentNotices.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); void openDetail(item); }}>
                        <span className={`state ${item.stateTone}`}>{item.state}</span>
                        <span><b>{item.title}</b><small>{item.region} · {item.type}</small></span>
                        <Icon name="arrow" />
                      </button>
                      <div className="recent-actions">
                        <button type="button" onClick={() => void toggleSaved(item.id)} aria-label={`${item.title} 관심청약 ${savedIds.has(item.id) ? "해제" : "저장"}`}><Icon name="bookmark" /> {savedIds.has(item.id) ? "저장됨" : "관심"}</button>
                        <button type="button" onClick={() => void toggleComparison(item.id)} disabled={comparisonPendingId !== undefined || comparisonResetPending} aria-label={`${item.title} ${comparisonIds.includes(item.id) ? "비교 해제" : "비교 담기"}`}><Icon name="grid" /> {comparisonIds.includes(item.id) ? "비교 해제" : "비교"}</button>
                        <button type="button" onClick={() => setRecentNoticeIds((ids) => ids.filter((id) => id !== item.id))} aria-label={`${item.title} 최근 본 공고에서 삭제`}><Icon name="close" /></button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="schedule-card" id="schedule">
              <div className="side-title"><div><span>UPCOMING</span><h2>다가오는 일정</h2></div><button type="button" onClick={() => { setActiveStatus("all"); scrollToResults(); }}>전체보기</button></div>
              {schedule.length > 0 ? <ol>
                {schedule.map(({ item, event }) => <li key={`${item.id}-${event.date}`}>
                  <div className="timeline-date"><strong>{Number(event.date.slice(8))}</strong><span>{event.date === today ? "오늘" : weekday(event.date)}</span></div>
                  <div><b>{item.title}</b><span>{event.label}</span></div><i className={event.tone}></i>
                </li>)}
              </ol> : <p className="schedule-empty">예정된 일정을 확인 중입니다.</p>}
            </section>
          </aside>
        </div>
      </section>

      <footer><div className="footer-inner"><span>청약한눈</span><p>놓치지 말아야 할 청약 정보를 가장 쉽게.</p><small>정보는 참고용이며 신청 전 청약홈 공식 공고문을 반드시 확인하세요.</small></div></footer>

      <nav className="mobile-nav" aria-label="모바일 메뉴">
        <a className="active" href="#top"><Icon name="home" /><span>홈</span></a>
        <a href="#applications"><Icon name="search" /><span>청약찾기</span></a>
        <a href="#schedule"><Icon name="calendar" /><span>일정</span></a>
        <button type="button" onClick={() => { setSavedOnly(true); setFavoriteProgressFilter("ALL"); setActiveStatus("all"); resetVisible(); scrollToResults(); }}><Icon name="bookmark" /><span>관심</span></button>
        <button type="button" onClick={() => setMemberDialog(member ? "account" : "login")} disabled={authLoading}><Icon name="user" /><span>{member ? "내 정보" : "로그인"}</span></button>
      </nav>

      {comparisonNotices.length > 0 && (
        <section className="compare-tray" aria-label="청약 공고 비교 목록">
          <div className="compare-summary"><b>공고 비교</b><span>{comparisonNotices.length}/3개 선택</span></div>
          <div className="compare-items">
            {comparisonNotices.map((item) => <span key={item.id}><b>{item.title}</b><button type="button" onClick={() => void toggleComparison(item.id)} disabled={comparisonPendingId !== undefined || comparisonResetPending} aria-label={`${item.title} 비교 목록에서 삭제`}><Icon name="close" /></button></span>)}
          </div>
          <button className="compare-reset" type="button" onClick={() => void resetComparisons()} disabled={comparisonResetPending || comparisonPendingId !== undefined}>전체 해제</button>
          <button className="compare-open" type="button" onClick={openComparison} disabled={comparisonNotices.length < 2}>{comparisonNotices.length < 2 ? "1개 더 선택" : "비교하기"}</button>
        </section>
      )}

      {filterOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFilterOpen(false); }}>
          <section ref={filterDialogRef} tabIndex={-1} className="modal filter-modal" role="dialog" aria-modal="true" aria-labelledby="filter-title">
            <div className="modal-head"><div><span>FILTER</span><h2 id="filter-title">청약 조건 선택</h2></div><button type="button" onClick={() => setFilterOpen(false)} aria-label="닫기"><Icon name="close" /></button></div>
            <div className="filter-group"><h3>지역</h3><div className="choice-grid">{["전체", ...availableRegions].map((item) => <button className={region === item ? "active" : ""} type="button" key={item} onClick={() => { setRegion(item); resetVisible(); }}>{item}</button>)}</div></div>
            <div className="filter-group"><h3>주택 유형</h3><div className="choice-grid">{["전체", ...availableCategories].map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => { setCategory(item); resetVisible(); }}>{item}</button>)}</div></div>
            <div className="filter-group"><h3>공급 방식</h3><div className="choice-grid">{([undefined, "SALE", "PUBLIC_RENTAL"] as const).map((item) => <button className={supplyType === item ? "active" : ""} type="button" key={item ?? "ALL"} onClick={() => { setSupplyType(item); resetVisible(); }}>{item ? SUPPLY_TYPE_LABELS[item] : "전체"}</button>)}</div><p className="price-help">분양은 아파트·오피스텔 청약 공고이며, 일반 부동산 매매 매물은 포함하지 않습니다.</p></div>
            <div className="filter-group"><h3>분양가 예산 <small>(만원 · 주택형 가격대 기준)</small></h3><RangeFilter presets={[{ label: "3억 이하", min: "", max: "30000" }, { label: "5억 이하", min: "", max: "50000" }, { label: "10억 이하", min: "", max: "100000" }]} key={`price-${rangeResetVersion}`} label="예산" unit="만원" limit={1000000} min={minPriceManwon} max={maxPriceManwon} placeholders={["예: 30000", "예: 60000"]} onInvalid={setPriceInvalid} onChange={(min, max) => { setMinPriceManwon(min); setMaxPriceManwon(max); resetVisible(); }} /><p className="price-help">주택형별 최고 분양가가 예산 안에 있는 공고를 보여줍니다. 주택형 정보가 없으면 공고 가격 범위로 확인하며, 가격 미확인 공고는 제외됩니다.</p></div>
            <div className="filter-group"><h3>공급면적 <small>(㎡ · 주택형 기준)</small></h3><RangeFilter presets={[{ label: "60㎡ 이하", min: "", max: "60" }, { label: "85㎡ 이하", min: "", max: "85" }, { label: "100㎡ 이상", min: "100", max: "" }]} key={`area-${rangeResetVersion}`} label="면적" unit="㎡" limit={1000} min={minArea} max={maxArea} placeholders={["예: 59", "예: 84"]} onInvalid={setAreaInvalid} onChange={(min, max) => { setMinArea(min); setMaxArea(max); resetVisible(); }} /><p className="price-help">예산도 지정하면 같은 주택형이 예산과 면적을 모두 만족해야 합니다. 면적 데이터가 없는 공고는 제외됩니다.</p></div>
            <div className="search-preference-box">
              <div><b>내 맞춤 검색조건</b><span>지역·유형·예산·상태·정렬을 계정에 저장합니다.</span></div>
              {member ? (
                <>
                  {searchPreference && (
                    <div className="saved-preference">
                      <p>{searchPreference.region ?? "전국"} · {searchPreference.housingCategory ? CATEGORY_LABELS[searchPreference.housingCategory] : "전체 유형"} · {searchPreference.supplyType ? SUPPLY_TYPE_LABELS[searchPreference.supplyType] : "전체 공급"} · {formatPricePreference(searchPreference)} · {formatAreaPreference(searchPreference)} · {STATUS_LABELS[searchPreference.status.toLowerCase() as StatusKey]} · {formatNoticeSort(searchPreference.sort)}</p>
                      <button type="button" onClick={() => { applySearchPreference(searchPreference); setToast("저장된 검색조건을 적용했습니다."); }} disabled={preferenceBusy}>불러오기</button>
                      <button type="button" onClick={() => void handleDeleteSearchPreference()} disabled={preferenceBusy}>삭제</button>
                    </div>
                  )}
                  <button className="save-preference-button" type="button" onClick={() => void handleSaveSearchPreference()} disabled={preferenceBusy || rangeInvalid}>{preferenceBusy ? "처리 중…" : "현재 조건 계정에 저장"}</button>
                  <SavedSearchProfilesPanel key={member.id} state={profilesState} disabled={preferenceBusy || rangeInvalid} input={currentSearchInput()}
                    summary={profile => `${profile.region ?? "전국"} · ${profile.housingCategory ? CATEGORY_LABELS[profile.housingCategory] : "전체 유형"} · ${profile.supplyType ? SUPPLY_TYPE_LABELS[profile.supplyType] : "전체 공급"} · ${formatPricePreference(profile)} · ${formatAreaPreference(profile)}`}
                    onApply={profile => { applySearchPreference(profile); setToast(`'${profile.name}' 조건을 적용했습니다.`); }}
                    onEdit={openSavedSearchProfileEditor} />
                </>
              ) : (
                <button className="save-preference-button" type="button" disabled={rangeInvalid} onClick={() => void handleSaveSearchPreference()}>로그인하고 조건 저장</button>
              )}
            </div>
            <div className="modal-actions"><button className="reset-button" type="button" onClick={() => { setRangeResetVersion(version => version + 1); setRegion("전체"); setCategory("전체"); setSupplyType(undefined); setMinPriceManwon(""); setMaxPriceManwon(""); setMinArea(""); setMaxArea(""); setIncludeClosed(false); resetVisible(); }}>초기화</button><button className="primary-button" type="button" disabled={rangeInvalid} onClick={() => { rememberSearch(); setFilterOpen(false); setSavedOnly(false); window.setTimeout(scrollToResults, 0); }}>{loading || loadRetryPending ? "검색 중 · 결과 화면 보기" : loadError ? "조회 상태 확인하기" : `공고 ${noticeTotal}건 보기`}</button></div>
          </section>
        </div>
      )}

      {editingSavedSearchProfile && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeProfileEditor(); }}>
          <section ref={savedSearchProfileEditorRef} tabIndex={-1} className="modal profile-editor-modal" role="dialog" aria-modal="true" aria-labelledby="saved-search-profile-editor-title">
            <div className="modal-head"><div><span>SAVED FILTER</span><h2 id="saved-search-profile-editor-title">저장 조건 수정</h2></div><button type="button" onClick={() => closeProfileEditor()} aria-label="닫기"><Icon name="close" /></button></div>
            <form onSubmit={(event) => void handleUpdateSavedSearchProfile(event)}>
              <label className="profile-editor-field">조건 이름<input autoFocus value={savedSearchProfileName} maxLength={40} onChange={(event) => setSavedSearchProfileName(event.target.value)} placeholder="예: 서울 신혼부부" /></label>
              <div className="profile-editor-fields">
                <label>지역<select value={savedSearchProfileDraft.region ?? ""} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, region: event.target.value || undefined }))}><option value="">전국</option>{availableRegions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
                <label>주택 유형<select value={savedSearchProfileDraft.housingCategory ?? ""} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, housingCategory: event.target.value as HousingCategory || undefined }))}><option value="">전체 유형</option>{(Object.entries(CATEGORY_LABELS) as Array<[HousingCategory, string]>).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>공급 방식<select value={savedSearchProfileDraft.supplyType ?? ""} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, supplyType: event.target.value as SupplyType || undefined }))}><option value="">전체 공급</option>{(Object.entries(SUPPLY_TYPE_LABELS) as Array<[SupplyType, string]>).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>공고 상태<select value={savedSearchProfileDraft.status} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, status: event.target.value as SearchPreferenceInput["status"] }))}>{(["ALL", "TODAY", "OPEN", "UPCOMING"] as const).map((value) => <option value={value} key={value}>{STATUS_LABELS[value.toLowerCase() as StatusKey]}</option>)}</select></label>
                <label>정렬<select value={savedSearchProfileDraft.sort} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, sort: event.target.value as SearchPreferenceInput["sort"] }))}><option value="LATEST">최신 공고순</option><option value="DEADLINE">마감 임박순</option><option value="APPLY_START">접수 시작일순</option><option value="WINNER_ANNOUNCEMENT">당첨 발표일순</option><option value="PRICE_ASC">낮은 분양가순</option><option value="SUPPLY_DESC">공급 세대 많은순</option></select></label>
                <label>최소 예산 (만원)<input type="number" min="0" max="1000000" inputMode="numeric" value={savedSearchProfileDraft.minPriceManwon ?? ""} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, minPriceManwon: priceInManwon(event.target.value) }))} placeholder="예: 30000" /></label>
                <label>최대 예산 (만원)<input type="number" min="0" max="1000000" inputMode="numeric" value={savedSearchProfileDraft.maxPriceManwon ?? ""} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, maxPriceManwon: priceInManwon(event.target.value) }))} placeholder="예: 60000" /></label>
                <label>최소 면적 (㎡)<input type="number" min="0" max="1000" inputMode="decimal" value={savedSearchProfileDraft.minArea ?? ""} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, minArea: priceInManwon(event.target.value) }))} placeholder="예: 59" /></label>
                <label>최대 면적 (㎡)<input type="number" min="0" max="1000" inputMode="decimal" value={savedSearchProfileDraft.maxArea ?? ""} onChange={(event) => setSavedSearchProfileDraft((draft) => ({ ...draft, maxArea: priceInManwon(event.target.value) }))} placeholder="예: 84" /></label>
              </div>
              {profileEditorError && <p role="alert" className="member-message error">{profileEditorError}</p>}
              {profilesState.error && <div role="alert"><p>{profilesState.error}</p><button type="button" disabled={profilesState.loading || profilesState.busy || profilesState.blocked} onClick={profilesState.refresh}>저장 목록 다시 확인</button></div>}
              <div className="modal-actions"><button className="reset-button" type="button" onClick={() => closeProfileEditor()}>취소</button><button className="primary-button" type="submit" disabled={preferenceBusy || profilesState.locked}>{profilesState.busy ? "저장 중…" : "저장"}</button></div>
            </form>
          </section>
        </div>
      )}

      <NoticeDetailDialog detailApplication={detailApplication} selectedDetail={selectedDetail} selectedChanges={selectedChanges}
        detailLoading={detailLoading} detailError={detailError} online={online} detailUnitRange={detailUnitRange}
        signedIn={Boolean(member)} saved={Boolean(detailApplication && savedIds.has(detailApplication.id))}
        tracker={detailApplication ? favoriteTrackers.get(detailApplication.id) : undefined}
        trackerBusy={favoriteTrackerPendingId === detailApplication?.id && favoriteTrackerPendingId !== undefined}
        favoriteBusy={favoritePendingId === detailApplication?.id && favoritePendingId !== undefined}
        noticeCopy={noticeCopy} closeDetail={closeDetail}
        onRetry={() => { if (selected && !detailLoading) void openDetail(selected); }}
        onToggleSaved={() => { if (detailApplication) void toggleSaved(detailApplication.id); }}
        onCopy={() => { if (detailApplication) void copyNoticeLink(detailApplication.id); }}
        onSaveTracker={(...args) => { if (detailApplication) void saveFavoriteTracker(detailApplication.id, ...args); }} />

      {comparisonOpen && comparisonNotices.length >= 2 && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComparisonOpen(false); }}>
          <section ref={comparisonDialogRef} tabIndex={-1} className="modal compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
            <div className="modal-head"><div><span>NOTICE COMPARISON</span><h2 id="compare-title">청약 공고 비교</h2></div><button type="button" onClick={() => setComparisonOpen(false)} aria-label="닫기"><Icon name="close" /></button></div>
            <ComparisonTable items={comparisonNotices.map(item => ({ ...item, winnerDate: formatShortDate(item.winnerAnnounceDate) }))} busy={comparisonPendingId !== undefined || comparisonResetPending} onRemove={id => void toggleComparison(id)} />
            <LinkCopyFeedback state={comparisonCopy} />
            <div className="compare-footer"><p>최종 신청 전 공식 공고문의 자격과 일정을 확인하세요.</p><div><button type="button" disabled={comparisonCopy.busy} onClick={copyComparisonLink}>비교 링크 복사</button><button type="button" onClick={() => downloadCalendar(comparisonNotices, "cheongyak-comparison.ics")}><Icon name="calendar" /> 비교 일정 저장</button></div></div>
          </section>
        </div>
      )}

      {qualOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQualification(); }}>
          <section ref={qualificationDialogRef} tabIndex={-1} className="modal qualify-modal" role="dialog" aria-modal="true" aria-labelledby="qual-title">
            <div className="modal-head"><div><span>PRE-CHECK</span><h2 id="qual-title">청약 조건 사전점검</h2></div><button type="button" onClick={closeQualification} aria-label="닫기"><Icon name="close" /></button></div>
            {qualStep < eligibilityQuestions.length ? (
              <div className="question-area">
                <div className="progress"><i style={{ width: `${((qualStep + 1) / eligibilityQuestions.length) * 100}%` }}></i></div>
                <small>{qualStep + 1} / {eligibilityQuestions.length}</small>
                <h3>{eligibilityQuestions[qualStep].title}</h3>
                <p>{eligibilityQuestions[qualStep].detail}</p>
                <div className="answer-buttons">{eligibilityQuestions[qualStep].options.map((option) => <button type="button" key={option.value} onClick={() => answerQuestion(option.value)}>{option.label}<Icon name="arrow" /></button>)}</div>
                <p className="answer-privacy">답변은 결과 확인 후 내 계정에 저장되며 언제든 수정·삭제할 수 있습니다.</p>
                {qualStep > 0 && <button className="back-button" type="button" onClick={() => { setQualStep((step) => step - 1); setAnswers((items) => items.slice(0, -1)); }}>이전 질문</button>}
              </div>
            ) : (
              <div className="result-area">
                <span className="result-icon"><Icon name="check" /></span>
                <small>나의 확인 체크리스트</small>
                <h3>{eligibilityResult.headline}</h3>
                <ul className="eligibility-check-list">{eligibilityResult.checks.map((check) => <li key={check}><Icon name="check" /> <span>{check}</span></li>)}</ul>
                <p className="eligibility-disclaimer"><strong>자격 판정 결과가 아닙니다.</strong> 실제 신청 가능 여부는 모집공고일의 관계 법령과 공식 공고문, 사업주체 심사 결과에 따라 달라질 수 있습니다.</p>
                <div className="eligibility-result-actions">
                  <button type="button" onClick={() => { closeQualification(); scrollToResults(); }}>실제 공고 보기 <Icon name="arrow" /></button>
                  <button type="button" onClick={() => { setAnswers([]); setQualStep(0); }}>답변 수정</button>
                  <button className="primary-button" type="button" disabled={eligibilityBusy} onClick={() => void handleSaveEligibilityProfile()}>{eligibilityBusy ? "저장 중…" : eligibilityProfile ? "변경사항 저장" : "내 계정에 저장"}</button>
                  {eligibilityProfile && <button className="danger-text-button" type="button" disabled={eligibilityBusy} onClick={() => void handleDeleteEligibilityProfile()}>저장 내용 삭제</button>}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <MemberDialogs
        mode={memberDialog}
        member={member}
        onModeChange={setMemberDialog}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onRequestEmailVerification={handleRequestEmailVerification}
        onRequestPasswordReset={handleRequestPasswordReset}
        onResetPassword={handleResetPassword}
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
        onDeletePersonalProfile={handleDeletePersonalProfile}
        onChangePassword={handleChangePassword}
        onWithdraw={handleWithdraw}
        onLoadSessions={fetchMemberSessions}
        onRevokeSession={revokeMemberSession}
        onRevokeOtherSessions={revokeOtherMemberSessions}
        onLoadPolicyConsents={fetchPolicyConsents}
      />

      <NotificationsDialog
        open={notificationsOpen && Boolean(member)}
        onClose={() => setNotificationsOpen(false)}
        onOpenNotice={(noticeId) => { void openNotificationNotice(noticeId); }}
        onUnreadCountChange={setUnreadNotificationCount}
      />

      <AdminSyncDialog open={adminSyncOpen && member?.role === "ADMIN"} currentMemberId={member?.id ?? 0} onClose={() => setAdminSyncOpen(false)} />
      <FavoriteCalendarDialog open={favoriteCalendarOpen} notices={savedNotices} onClose={() => setFavoriteCalendarOpen(false)} onOpenNotice={(noticeId) => { void openNotificationNotice(noticeId); }} />

      {toast && <div className="toast" role="status"><Icon name="check" /> {toast}</div>}
    </main>
  );
}
