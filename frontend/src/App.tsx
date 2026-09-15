Warning: truncated output (original token count: 27348)
Total output lines: 1962

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  changeMemberPassword,
  clearComparisons,
  confirmEmailVerification,
  deleteSearchPreference,
  deleteEligibilityProfile,
  dismissMemberRecommendation,
  fetchNoticeFacets,
  fetchNoticePage,
  fetchCurrentMember,
  fetchComparisonIds,
  fetchFavoriteIds,
  fetchFavoriteTrackers,
  fetchMemberSessions,
  fetchMemberRecommendations,
  fetchNotice,
  fetchNoticeChanges,
  fetchNotificationInbox,
  fetchSearchPreference,
  fetchEligibilityProfile,
  HousingCategory,
  FavoriteProgress,
  FavoriteApplicationResult,
  FavoriteTracker,
  EligibilityProfile,
  loginMember,
  logoutMember,
  MemberProfile,
  MemberProfileInput,
  MemberRecommendationList,
  MemberSearchPreference,
  mergeFavoriteIds,
  mergeComparisonIds,
  NoticeDetail,
  NoticeChange,
  NoticeSummary,
  NoticeStatus,
  NoticeSearchFacets,
  saveSearchPreference,
  saveEligibilityProfile,
  revokeMemberSession,
  revokeOtherMemberSessions,
  resetDismissedRecommendations,
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
  updateComparison,
  updateRecentNoticeIds,
} from "./noticeTools";

type StatusKey = "all" | "today" | "open" | "upcoming";
type StateTone = "mint" | "coral" | "blue" | "purple" | "gray";
type PresentationStatus = Exclude<StatusKey, "all"> | "announcement" | "closed";
type IconName = "search" | "pin" | "home" | "calendar" | "bookmark" | "arrow" | "check" | "bell" | "grid" | "close" | "filter" | "user";
type FavoriteProgressFilter = FavoriteProgress | "ALL" | "INCOMPLETE" | "RESULT_PENDING" | "RESULT_SELECTED" | "RESULT_WAITLISTED" | "RESULT_NOT_SELECTED";
type FavoriteChecklistKey = "noticeDocumentChecked" | "eligibilityChecked" | "scheduleChecked" | "fundsChecked";

const FAVORITE_PROGRESS_LABELS: Record<FavoriteProgress, string> = {
  SAVED: "저장만 함",
  CHECKING: "조건 확인 중",
  READY: "신청 준비 완료",
  APPLIED: "신청 완료",
};

const FAVORITE_PROGRESS_PRIORITY: Record<FavoriteProgress, number> = {
  CHECKING: 0,
  READY: 1,
  SAVED: 2,
  APPLIED: 3,
};

const FAVORITE_APPLICATION_RESULT_LABELS: Record<FavoriteApplicationResult, string> = {
  PENDING: "발표 대기",
  SELECTED: "당첨",
  WAITLISTED: "예비 당첨",
  NOT_SELECTED: "미당첨",
};

const FAVORITE_APPLICATION_RESULT_PRIORITY: Record<FavoriteApplicationResult, number> = {
  PENDING: 0,
  WAITLISTED: 1,
  SELECTED: 2,
  NOT_SELECTED: 3,
};

const FAVORITE_CHECKLIST_ITEMS: { key: FavoriteChecklistKey; label: string }[] = [
  { key: "noticeDocumentChecked", label: "공고문 확인" },
  { key: "eligibilityChecked", label: "자격 조건 확인" },
  { key: "scheduleChecked", label: "접수 일정 확인" },
  { key: "fundsChecked", label: "자금 계획 확인" },
];

function completedChecklistCount(tracker?: FavoriteTracker): number {
  return FAVORITE_CHECKLIST_ITEMS.filter(({ key }) => tracker?.[key]).length;
}

function incompleteChecklistLabels(tracker?: FavoriteTracker): string {
  return FAVORITE_CHECKLIST_ITEMS.filter(({ key }) => !tracker?.[key]).map(({ label }) => label).join(" · ");
}

function applicationResultFromFilter(filter: FavoriteProgressFilter): FavoriteApplicationResult | undefined {
  if (!filter.startsWith("RESULT_")) return undefined;
  return filter.slice("RESULT_".length) as FavoriteApplicationResult;
}

type Application = NoticeSummary & {
  state: string;
  stateTone: StateTone;
  statusKey: PresentationStatus;
  location: string;
  region: string;
  type: string;
  category: string;
  period: string;
  dday: string;
  priceLabel: string;
  price: string;
  scale: string;
  fit: string;
  deposit: string;
};

const CATEGORY_LABELS: Record<HousingCategory, string> = {
  APARTMENT: "아파트",
  PUBLIC_RENTAL: "공공임대",
  OFFICETEL: "오피스텔",
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

const Icon = ({ name }: { name: IconName }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4Z"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    close: <><path d="M5 5l14 14M19 5 5 19"/></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

function koreaToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function dateValue(iso?: string): number | undefined {
  if (!iso) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(from: string, to?: string): number | undefined {
  const fromValue = dateValue(from);
  const toValue = dateValue(to);
  if (fromValue === undefined || toValue === undefined) return undefined;
  return Math.round((toValue - fromValue) / 86_400_000);
}

function formatShortDate(iso?: string): string {
  if (!iso) return "일정 미정";
  const [, month, day] = iso.split("-").map(Number);
  return `${month}. ${day}.`;
}

function formatPeriod(start?: string, end?: string, winner?: string): string {
  if (start && end) return `${formatShortDate(start)} — ${formatShortDate(end)}`;
  if (start) return `${formatShortDate(start)} 접수 시작`;
  if (winner) return `당첨 발표 ${formatShortDate(winner)}`;
  return "세부 일정은 공고문 확인";
}

function formatMoveInMonth(value?: string): string {
  if (!value) return "입주 일정 미정";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return value;
  return `${digits.slice(0, 4)}년 ${Number(digits.slice(4, 6))}월 예정`;
}

function optionalPeriod(start?: string, end?: string): string {
  if (!start && !end) return "일정 미정";
  if (start && end) return `${formatShortDate(start)} — ${formatShortDate(end)}`;
  return start ? `${formatShortDate(start)}부터` : `${formatShortDate(end)}까지`;
}

function formatChangedAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hasExpandedDetails(detail: NoticeDetail): boolean {
  return Boolean(
    detail.postalCode
    || detail.housingDetailType
    || detail.rentType
    || detail.businessEntityName
    || detail.constructionCompanyName
    || detail.contactPhone
    || detail.homepageUrl
    || detail.moveInPlannedMonth
    || detail.specialSupplyStartDate
    || detail.specialSupplyEndDate
    || detail.contractStartDate
    || detail.contractEndDate,
  );
}

function weekday(iso?: string): string {
  const value = dateValue(iso);
  return value === undefined ? "" : ["일", "월", "화", "수", "목", "금", "토"][new Date(value).getUTCDay()];
}

function regionLabel(regionCode?: string, address?: string): string {
  const text = `${regionCode ?? ""} ${address ?? ""}`;
  const aliases: Array<[string, string[]]> = [
    ["서울", ["서울"]], ["경기", ["경기"]], ["인천", ["인천"]], ["부산", ["부산"]],
    ["대구", ["대구"]], ["광주", ["광주"]], ["대전", ["대전"]], ["울산", ["울산"]],
    ["세종", ["세종"]], ["강원", ["강원"]], ["충북", ["충청북도", "충북"]],
    ["충남", ["충청남도", "충남"]], ["전북", ["전북특별자치도", "전라북도", "전북"]],
    ["전남", ["전라남도", "전남"]], ["경북", ["경상북도", "경북"]],
    ["경남", ["경상남도", "경남"]], ["제주", ["제주"]],
  ];
  return aliases.find(([, names]) => names.some((name) => text.includes(name)))?.[0] ?? regionCode ?? "지역 미정";
}

function formatWon(value?: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value >= 100_000_000) {
    const eok = value / 100_000_000;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억`;
  }
  return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
}

function statusPresentation(status: NoticeStatus, applyEndDate?: string): {
  state: string;
  stateTone: StateTone;
  statusKey: PresentationStatus;
} {
  if (applyEndDate === koreaToday()) return { state: "오늘 마감", stateTone: "coral", statusKey: "today" };
  if (status === "OPEN") return { state: "접수중", stateTone: "mint", statusKey: "open" };
  if (status === "UPCOMING") return { state: "오픈 예정", stateTone: "blue", statusKey: "upcoming" };
  if (status === "ANNOUNCED") return { state: "당첨 발표", stateTone: "purple", statusKey: "announcement" };
  return { state: "접수 마감", stateTone: "gray", statusKey: "closed" };
}

function toApplication(notice: NoticeSummary): Application {
  const today = koreaToday();
  const status = statusPresentation(notice.status, notice.applyEndDate);
  const targetDate = notice.status === "UPCOMING" ? notice.applyStartDate
    : notice.status === "ANNOUNCED" ? notice.winnerAnnounceDate
      : notice.applyEndDate;
  const remaining = daysBetween(today, targetDate);
  const minPrice = formatWon(notice.minPrice);
  const maxPrice = formatWon(notice.maxPrice);
  const publicRental = notice.housingCategory === "PUBLIC_RENTAL";
  const priceLabel = publicRental ? "임대보증금" : "분양가";
  const price = minPrice && maxPrice
    ? `${priceLabel} ${minPrice} — ${maxPrice}`
    : minPrice ? `${publicRental ? "최소 임대보증금" : "분양가"} ${minPrice}부터`
      : `${priceLabel}은 공고문 확인`;
  const category = CATEGORY_LABELS[notice.housingCategory];
  const sourceName = notice.sourceSystem === "MYHOME_PUBLIC_RENTAL" ? "마이홈포털" : "청약홈";

  return {
    ...notice,
    ...status,
    location: notice.address || "공급 위치는 공고문 확인",
    region: regionLabel(notice.regionCode, notice.address),
    type: `${category} · ${sourceName}`,
    category,
    period: formatPeriod(notice.applyStartDate, notice.applyEndDate, notice.winnerAnnounceDate),
    dday: remaining === undefined ? "일정 확인" : remaining === 0 ? "D-DAY" : remaining > 0 ? `D-${remaining}` : "마감",
    priceLabel,
    price,
    scale: notice.totalUnits ? `총 ${notice.totalUnits.toLocaleString("ko-KR")}세대 공급` : "공급 규모는 공고문 확인",
    fit: notice.sourceSystem === "MYHOME_PUBLIC_RENTAL"
      ? "국토교통부 마이홈포털 공식 공고"
      : "한국부동산원 청약홈 공식 공고",
    deposit: publicRental
      ? "임대 조건과 신청 자격은 원문 공고에서 확인"
      : "신청 자격과 예치금은 원문 공고에서 확인",
  };
}

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

function categoryValue(label: string): HousingCategory | undefined {
  return (Object.entries(CATEGORY_LABELS) as Array<[HousingCategory, string]>)
    .find(([, categoryLabel]) => categoryLabel === label)?.[0];
}

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

export default function Home() {
  const initialSearch = noticeSearchStateFromSearch(window.location.search);
  const [notices, setNotices] = useState<NoticeSummary[]>([]);
  const [knownNotices, setKnownNotices] = useState<Map<number, NoticeSummary>>(new Map());
  const [noticeFacets, setNoticeFacets] = useState<NoticeSearchFacets>({ total: 0, endingToday: 0, open: 0, upcoming: 0 });
  const [noticePage, setNoticePage] = useState(0);
  const [noticeTotal, setNoticeTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [query, setQuery] = useState(initialSearch.query);
  const [activeStatus, setActiveStatus] = useState<StatusKey>(initialSearch.status);
  const [region, setRegion] = useState(initialSearch.region ?? "전체");
  const [category, setCategory] = useState(initialSearch.category ? CATEGORY_LABELS[initialSearch.category] : "전체");
  const [sortKey, setSortKey] = useState<NoticeSortKey>(initialSearch.sort);
  const [minPriceManwon, setMinPriceManwon] = useState(initialSearch.minPriceManwon ? String(initialSearch.minPriceManwon) : "");
  const [maxPriceManwon, setMaxPriceManwon] = useState(initialSearch.maxPriceManwon ? String(initialSearch.maxPriceManwon) : "");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [favoriteTrackers, setFavoriteTrackers] = useState<Map<number, FavoriteTracker>>(new Map());
  const [favoriteTrackerPendingId, setFavoriteTrackerPendingId] = useState<number>();
  const [favoritePendingId, setFavoritePendingId] = useState<number>();
  const [savedOnly, setSavedOnly] = useState(false);
  const [favoriteProgressFilter, setFavoriteProgressFilter] = useState<FavoriteProgressFilter>("ALL");
  const [comparisonIds, setComparisonIds] = useState<number[]>(initialComparisonIds);
  const [comparisonPendingId, setComparisonPendingId] = useState<number>();
  const [comparisonResetPending, setComparisonResetPending] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [, setVisibleCount] = useState(6);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<NoticeDetail | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<NoticeChange[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [qualOpen, setQualOpen] = useState(false);
  const [qualStep, setQualStep] = useState(0);
  const [answers, setAnswers] = useState<EligibilityAnswer[]>([]);
  const [toast, setToast] = useState("");
  const [member, setMember] = useState<MemberProfile>();
  const [memberDialog, setMemberDialog] = useState<MemberDialogMode>(null);
  const [passwordResetToken, setPasswordResetToken] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [searchPreference, setSearchPreference] = useState<MemberSearchPreference>();
  const [eligibilityProfile, setEligibilityProfile] = useState<EligibilityProfile>();
  const [eligibilityBusy, setEligibilityBusy] = useState(false);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [recommendations, setRecommendations] = useState<MemberRecommendationList>();
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [recommendationsBusy, setRecommendationsBusy] = useState(false);
  const [recommendationsVersion, setRecommendationsVersion] = useState(0);
  const [adminSyncOpen, setAdminSyncOpen] = useState(false);
  const [favoriteCalendarOpen, setFavoriteCalendarOpen] = useState(false);
  const [detailRouteVersion, setDetailRouteVersion] = useState(0);
  const [recentNoticeIds, setRecentNoticeIds] = useState<number[]>(initialRecentNoticeIds);

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
      window.history.back();
      return;
    }
    window.history.replaceState(window.history.state, "", noticeUrl(window.location.href));
    clearDetail();
  };

  const applySearchPreference = (preference: MemberSearchPreference) => {
    setRegion(preference.region ?? "전체");
    setCategory(preference.housingCategory ? CATEGORY_LABELS[preference.housingCategory] : "전체");
    setActiveStatus(preference.status.toLowerCase() as StatusKey);
    setSortKey(preference.sort);
    setMinPriceManwon(preference.minPriceManwon ? String(preference.minPriceManwon) : "");
    setMaxPriceManwon(preference.maxPriceManwon ? String(preference.maxPriceManwon) : "");
    setSavedOnly(false);
    setVisibleCount(6);
  };

  const currentSearchRequest = () => ({
    category: categoryValue(category),
    status: activeStatus === "open" ? "OPEN" as const : activeStatus === "upcoming" ? "UPCOMING" as const : undefined,
    keyword: query,
    region: region === "전체" ? undefined : region,
    minPrice: priceInWon(minPriceManwon),
    maxPrice: priceInWon(maxPriceManwon),
    ids: savedOnly ? [...savedIds] : undefined,
    endingToday: activeStatus === "today",
    sort: sortKey,
    size: 24,
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setLoadError("");
      const request = currentSearchRequest();
      if (savedOnly && request.ids?.length === 0) {
        setNotices([]);
        setNoticeTotal(0);
        setLoading(false);
        return;
      }
      Promise.all([
        fetchNoticePage({ ...request, page: 0 }, controller.signal),
        fetchNoticeFacets(request, controller.signal),
      ])
        .then(([page, facets]) => {
          setNotices(page.content);
          setNoticePage(0);
          setNoticeTotal(page.totalElements);
          setNoticeFacets(facets);
          setKnownNotices((known) => {
            const next = new Map(known);
            page.content.forEach((notice) => next.set(notice.id, notice));
            return next;
          });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setLoadError(error instanceof Error ? error.message : "청약 정보를 불러오지 못했습니다.");
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activeStatus, category, loadVersion, maxPriceManwon, minPriceManwon, query, region, savedIds, savedOnly, sortKey]);

  const loadMoreNotices = async () => {
    if (loadingMore || notices.length >= noticeTotal) return;
    setLoadingMore(true);
    try {
      const page = await fetchNoticePage({ ...currentSearchRequest(), page: noticePage + 1 });
      setNotices((items) => [...items, ...page.content]);
      setNoticePage(page.number);
      setKnownNotices((known) => {
        const next = new Map(known);
        page.content.forEach((notice) => next.set(notice.id, notice));
        return next;
      });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "다음 공고를 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  };

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
    const guestSavedIds = readGuestSavedIds();
    setSavedIds(guestSavedIds);

    fetchCurrentMember()
      .then(async (profile) => {
        if (!profile) return;
        if (cancelled) return;
        setMember(profile);
        try {
          const accountIds = guestSavedIds.size > 0
            ? await mergeFavoriteIds([...guestSavedIds])
            : await fetchFavoriteIds();
          if (cancelled) return;
          setSavedIds(new Set(accountIds));
          setFavoriteTrackers(new Map((await fetchFavoriteTrackers()).map((tracker) => [tracker.noticeId, tracker])));
          // 로그인 계정의 목록이 로그아웃 뒤 다른 사용자에게 보이지 않게 브라우저 복사본을 지운다.
          window.localStorage.removeItem("cheongyak-one-saved");
        } catch (error) {
          if (!cancelled) setToast(error instanceof Error ? error.message : "관심청약을 동기화하지 못했습니다.");
        }
        try {
          const accountComparisonIds = comparisonIds.length > 0
            ? await mergeComparisonIds(comparisonIds)
            : await fetchComparisonIds();
          if (cancelled) return;
          setComparisonIds(accountComparisonIds);
          window.localStorage.removeItem("cheongyak-one-comparison");
        } catch (error) {
          if (!cancelled) setToast(error instanceof Error ? error.message : "비교 목록을 동기화하지 못했습니다.");
        }
        try {
          const preference = await fetchSearchPreference();
          if (cancelled || !preference) return;
          setSearchPreference(preference);
          applySearchPreference(preference);
        } catch (error) {
          if (!cancelled) setToast(error instanceof Error ? error.message : "저장한 검색조건을 불러오지 못했습니다.");
        }
        try {
          const profile = await fetchEligibilityProfile();
          if (!cancelled) setEligibilityProfile(profile);
        } catch (error) {
          if (!cancelled) setToast(error instanceof Error ? error.message : "저장한 사전점검을 불러오지 못했습니다.");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setToast(error instanceof Error ? error.message : "회원 정보를 확인하지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!member) {
      setUnreadNotificationCount(0);
      return;
    }
    let cancelled = false;
    const refreshUnreadCount = () => {
      if (document.visibilityState !== "visible") return;
      fetchNotificationInbox()
        .then((inbox) => { if (!cancelled) setUnreadNotificationCount(inbox.unreadCount); })
        .catch(() => {
          // 일시적인 갱신 실패 시 기존 개수를 유지하고 다음 주기에 다시 시도한다.
        });
    };
    refreshUnreadCount();
    const timer = window.setInterval(refreshUnreadCount, 60_000);
    document.addEventListener("visibilitychange", refreshUnreadCount);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshUnreadCount);
    };
  }, [member]);

  useEffect(() => {
    if (!member) {
      setRecommendations(undefined);
      setRecommendationsError("");
      setRecommendationsLoading(false);
      return;
    }
    let cancelled = false;
    setRecommendationsLoading(true);
    setRecommendationsError("");
    fetchMemberRecommendations()
      .then((result) => {
        if (!cancelled) setRecommendations(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRecommendations(undefined);
          setRecommendationsError(error instanceof Error ? error.message : "맞춤 추천을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setRecommendationsLoading(false);
      });
    return () => { cancelled = true; };
  }, [member, searchPreference, recommendationsVersion]);

  useEffect(() => {
    const onPopState = () => {
      const restored = noticeSearchStateFromSearch(window.location.search);
      setQuery(restored.query);
      setActiveStatus(restored.status);
      setRegion(restored.region ?? "전체");
      setCategory(restored.category ? CATEGORY_LABELS[restored.category] : "전체");
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

    const controller = new AbortController();
    setDetailLoading(true);
    Promise.all([
      fetchNotice(noticeId, controller.signal),
      fetchNoticeChanges(noticeId, controller.signal).catch(() => [] as NoticeChange[]),
    ])
      .then(([detail, changes]) => {
        setSelected(toApplication(detail));
        setSelectedDetail(detail);
        setSelectedChanges(changes);
        setKnownNotices((known) => new Map(known).set(detail.id, detail));
        rememberNotice(detail.id);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        clearDetail();
        window.history.replaceState(window.history.state, "", noticeUrl(window.location.href));
        setToast(error instanceof Error ? error.message : "공고 상세 링크를 확인하지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
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
    if (member) window.localStorage.removeItem("cheongyak-one-comparison");
    else window.localStorage.setItem("cheongyak-one-comparison", JSON.stringify(comparisonIds));
    const searchUrl = noticeSearchUrl(window.location.href, {
      query,
      status: activeStatus,
      region: region === "전체" ? undefined : region,
      category: categoryValue(category),
      minPriceManwon: priceInManwon(minPriceManwon),
      maxPriceManwon: priceInManwon(maxPriceManwon),
      sort: sortKey,
    });
    const targetUrl = new URL(searchUrl);
    const params = targetUrl.searchParams;
    if (comparisonIds.length > 0) params.set("compare", comparisonIds.join(","));
    else params.delete("compare");
    window.history.replaceState(window.history.state, "", targetUrl.toString());
  }, [activeStatus, category, comparisonIds, maxPriceManwon, member, minPriceManwon, query, region, sortKey]);

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

    return { counts, applicationResults, recordedResults: applicationResults.SELECTED + applicationResults.WAITLISTED + applicationResults.NOT_SELECTED, urgent, checklistIncomplete };
  }, [favoriteTrackers, knownApplications, savedIds]);
  const visible = useMemo(() => {
    if (!savedOnly) return filtered;

    return filtered.filter((item) => {
      const tracker = favoriteTrackers.get(item.id);
      if (favoriteProgressFilter === "ALL") return true;
      if (favoriteProgressFilter === "INCOMPLETE") return (tracker?.progress ?? "SAVED") !== "APPLIED" && completedChecklistCount(tracker) < FAVORITE_CHECKLIST_ITEMS.length;
      const applicationResult = applicationResultFromFilter(favoriteProgressFilter);
      if (applicationResult) return tracker?.progress === "APPLIED" && (tracker.applicationResult ?? "PENDING") === applicationResult;
      return (tracker?.progress ?? "SAVED") === favoriteProgressFilter;
    }).sort((left, right) => {
      const leftProgress = favoriteTrackers.get(left.id)?.progress ?? "SAVED";
      const rightProgress = favoriteTrackers.get(right.id)?.progress ?? "SAVED";
      const progressOrder = FAVORITE_PROGRESS_PRIORITY[leftProgress] - FAVORITE_PROGRESS_PRIORITY[rightProgress];
      if (progressOrder !== 0) return progressOrder;
      if (leftProgress === "APPLIED" && rightProgress === "APPLIED") {
        const resultOrder = FAVORITE_APPLICATION_RESULT_PRIORITY[favoriteTrackers.get(left.id)?.applicationResult ?? "PENDING"] - FAVORITE_APPLICATION_RESULT_PRIORITY[favoriteTrackers.get(right.id)?.applicationResult ?? "PENDING"];
        if (resultOrder !== 0) return resultOrder;
      }
      return (dateValue(left.applyEndDate) ?? Number.MAX_SAFE_INTEGER) - (dateValue(right.applyEndDate) ?? Number.MAX_SAFE_INTEGER);
    });
  }, [favoriteProgressFilter, favoriteTrackers, filtered, savedOnly]);
  const activeFilterCount = Number(region !== "전체") + Number(category !== "전체") + Number(Boolean(minPriceManwon || maxPriceManwon));
  const todayCount = noticeFacets.endingToday;
  const openCount = noticeFacets.open;
  const upcomingCount = noticeFacets.upcoming;
  const statuses: { key: StatusKey; label: string; count: number; tone: string; icon: IconName }[] = [
    { key: "all", label: "전체 청약", count: noticeFacets.total, tone: "navy", icon: "grid" },
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
  const syncedAt = notices.map((notice) => notice.syncedAt).sort().at(-1);
  const syncedLabel = syncedAt ? new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(syncedAt)) : "동기화 전";
  const today = koreaToday();
  const [, thisMonth, thisDay] = today.split("-").map(Number);

  const scrollToResult…7348 tokens truncated…NG}</em>}
                      {favoritePreparation.recordedResults > 0 && <em>결과 기록 완료 {favoritePreparation.recordedResults}건</em>}
                      {favoritePreparation.checklistIncomplete > 0 && <em>확인 항목 남음 {favoritePreparation.checklistIncomplete}건</em>}
                      {favoritePreparation.urgent > 0 && <em>마감 3일 이내 {favoritePreparation.urgent}건</em>}
                    </div>
                    <div className="favorite-progress-filters" role="group" aria-label="관심청약 준비 상태 필터">
                      {(["ALL", "INCOMPLETE", "CHECKING", "READY", "APPLIED"] as const).map((progress) => (
                        <button className={favoriteProgressFilter === progress ? "active" : ""} type="button" key={progress} onClick={() => setFavoriteProgressFilter(progress)}>
                          {progress === "ALL" ? `전체 ${savedIds.size}` : progress === "INCOMPLETE" ? `확인 필요 ${favoritePreparation.checklistIncomplete}` : `${FAVORITE_PROGRESS_LABELS[progress]} ${favoritePreparation.counts[progress]}`}
                        </button>
                      ))}
                      {(["PENDING", "SELECTED", "WAITLISTED", "NOT_SELECTED"] as FavoriteApplicationResult[]).map((result) => {
                        const filter = `RESULT_${result}` as FavoriteProgressFilter;
                        return <button className={favoriteProgressFilter === filter ? "active result-filter" : "result-filter"} type="button" key={filter} onClick={() => setFavoriteProgressFilter(filter)} disabled={favoritePreparation.applicationResults[result] === 0}>
                          {FAVORITE_APPLICATION_RESULT_LABELS[result]} {favoritePreparation.applicationResults[result]}
                        </button>;
                      })}
                    </div>
                    {upcomingFavoriteEvents.length > 0 && (
                      <div className="favorite-upcoming-events" aria-label="다가오는 관심청약 일정">
                        <div><span>다가오는 내 일정</span><small>관심청약의 접수·당첨 발표 일정입니다.</small></div>
                        <ol>{upcomingFavoriteEvents.map((event) => <li key={`${event.item.id}-${event.label}-${event.date}`}><time>{formatShortDate(event.date)}</time><span>{event.label}</span><button type="button" onClick={() => openDetail(event.item)}>{event.item.title}</button></li>)}</ol>
                      </div>
                    )}
                  </section>
                )}
                <div className="application-list">
                  {visible.map((item) => (
                    <article className="application-card" key={item.id}>
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
                          <label>내 메모
                            <input key={`${item.id}-${favoriteTrackers.get(item.id)?.updatedAt ?? "new"}`} defaultValue={favoriteTrackers.get(item.id)?.memo ?? ""} maxLength={500} placeholder="예: 모집공고문 소득 기준 확인" onBlur={(event) => void saveFavoriteTracker(item.id, favoriteTrackers.get(item.id)?.progress ?? "SAVED", event.target.value)} />
                          </label>
                          <span className="favorite-checklist-progress">사전 확인 {completedChecklistCount(favoriteTrackers.get(item.id))}/4</span>
                          {completedChecklistCount(favoriteTrackers.get(item.id)) < FAVORITE_CHECKLIST_ITEMS.length && <span className="favorite-checklist-missing">남은 확인: {incompleteChecklistLabels(favoriteTrackers.get(item.id))}</span>}
                        </div>
                      )}
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
                          <small>{(favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING") === "PENDING" ? `당첨 발표일 ${formatShortDate(item.winnerAnnounceDate)}에 결과를 확인하세요.` : `${favoriteTrackers.get(item.id)?.applicationResultRecordedAt ? `${formatChangedAt(favoriteTrackers.get(item.id)?.applicationResultRecordedAt ?? "")} 기록` : "공식 당첨자 발표를 기준으로 직접 기록한 결과입니다."}`}</small>
                          {(favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING") !== "PENDING" && <input key={`${item.id}-${favoriteTrackers.get(item.id)?.applicationResultRecordedAt ?? "result"}`} defaultValue={favoriteTrackers.get(item.id)?.applicationResultMemo ?? ""} maxLength={500} placeholder="결과 메모 (예: 계약 일정 확인)" onBlur={(event) => void saveFavoriteTracker(item.id, "APPLIED", favoriteTrackers.get(item.id)?.memo ?? "", {}, favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING", event.target.value)} />}
                        </div>
                      )}
                      {savedOnly && member && (favoriteTrackers.get(item.id)?.progress ?? "SAVED") === "APPLIED" && <span className={`application-result-badge result-${favoriteTrackers.get(item.id)?.applicationResult?.toLowerCase() ?? "pending"}`}>{FAVORITE_APPLICATION_RESULT_LABELS[favoriteTrackers.get(item.id)?.applicationResult ?? "PENDING"]}</span>}
                      <div className="card-actions">
                        <button className="detail-link" type="button" onClick={() => openDetail(item)}>공고 핵심만 보기 <Icon name="arrow" /></button>
                        <button className={`compare-button ${comparisonIds.includes(item.id) ? "selected" : ""}`} type="button" onClick={() => void toggleComparison(item.id)} disabled={comparisonPendingId !== undefined || comparisonResetPending} aria-pressed={comparisonIds.includes(item.id)}><Icon name="grid" /> {comparisonIds.includes(item.id) ? "비교 해제" : "비교 담기"}</button>
                      </div>
                    </article>
                  ))}
                </div>
                {notices.length < noticeTotal && <button className="more-button" type="button" onClick={() => void loadMoreNotices()} disabled={loadingMore}>{loadingMore ? "불러오는 중" : `다음 ${Math.min(24, noticeTotal - notices.length)}건 더보기`} <Icon name="arrow" /></button>}
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><Icon name={savedOnly ? "bookmark" : "search"} /></span>
                <h3>{savedOnly ? favoriteProgressFilter === "ALL" ? "저장한 관심청약이 없어요" : favoriteProgressFilter === "INCOMPLETE" ? "확인 항목이 남은 관심청약이 없어요" : applicationResultFromFilter(favoriteProgressFilter) ? "선택한 신청 결과의 관심청약이 없어요" : "선택한 준비 상태의 관심청약이 없어요" : "조건에 맞는 공고가 없어요"}</h3>
                <p>{savedOnly ? favoriteProgressFilter === "ALL" ? "관심 있는 공고의 북마크를 눌러 모아보세요." : favoriteProgressFilter === "INCOMPLETE" ? "현재 보이는 관심청약의 체크리스트를 모두 완료했어요." : applicationResultFromFilter(favoriteProgressFilter) ? "신청 결과를 기록한 뒤 다시 확인해 보세요." : "다른 준비 상태를 선택하거나 전체 관심청약을 확인해 보세요." : "검색어나 지역·유형 필터를 조금 넓혀보세요."}</p>
                <button type="button" onClick={() => { if (savedOnly && favoriteProgressFilter !== "ALL") { setFavoriteProgressFilter("ALL"); return; } setQuery(""); setRegion("전체"); setCategory("전체"); setActiveStatus("all"); setSavedOnly(false); resetVisible(); }}>{savedOnly && favoriteProgressFilter !== "ALL" ? "전체 관심청약 보기" : "전체 청약 보기"}</button>
              </div>
            )}
          </div>

          <aside className="side-column">
            <RecommendationPanel
              signedIn={Boolean(member)}
              loading={authLoading || recommendationsLoading}
              error={recommendationsError}
              result={recommendations}
              onLogin={() => setMemberDialog("login")}
              onConfigure={() => setFilterOpen(true)}
              onOpenNotice={(noticeId) => { void openNotificationNotice(noticeId); }}
              onDismiss={(noticeId) => { void dismissRecommendation(noticeId); }}
              onResetDismissals={() => { void resetRecommendationDismissals(); }}
              busy={recommendationsBusy}
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
                      <button type="button" onClick={() => void openDetail(item)}>
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
            <div className="filter-group"><h3>분양가 예산 <small>(만원 · 최저 분양가 기준)</small></h3><div className="price-range"><label>최소<input type="number" min="0" max="1000000" inputMode="numeric" value={minPriceManwon} onChange={(event) => { setMinPriceManwon(event.target.value); resetVisible(); }} placeholder="예: 30000" /></label><span>~</span><label>최대<input type="number" min="0" max="1000000" inputMode="numeric" value={maxPriceManwon} onChange={(event) => { setMaxPriceManwon(event.target.value); resetVisible(); }} placeholder="예: 60000" /></label></div><p className="price-help">가격 정보가 없는 공고는 예산 필터 결과에서 제외됩니다.</p></div>
            <div className="search-preference-box">
              <div><b>내 맞춤 검색조건</b><span>지역·유형·예산·상태·정렬을 계정에 저장합니다.</span></div>
              {member ? (
                <>
                  {searchPreference && (
                    <div className="saved-preference">
                      <p>{searchPreference.region ?? "전국"} · {searchPreference.housingCategory ? CATEGORY_LABELS[searchPreference.housingCategory] : "전체 유형"} · {formatPricePreference(searchPreference)} · {STATUS_LABELS[searchPreference.status.toLowerCase() as StatusKey]} · {searchPreference.sort === "DEADLINE" ? "마감 임박순" : "최신순"}</p>
                      <button type="button" onClick={() => { applySearchPreference(searchPreference); setToast("저장된 검색조건을 적용했습니다."); }} disabled={preferenceBusy}>불러오기</button>
                      <button type="button" onClick={() => void handleDeleteSearchPreference()} disabled={preferenceBusy}>삭제</button>
                    </div>
                  )}
                  <button className="save-preference-button" type="button" onClick={() => void handleSaveSearchPreference()} disabled={preferenceBusy}>{preferenceBusy ? "처리 중…" : "현재 조건 계정에 저장"}</button>
                </>
              ) : (
                <button className="save-preference-button" type="button" onClick={() => void handleSaveSearchPreference()}>로그인하고 조건 저장</button>
              )}
            </div>
            <div className="modal-actions"><button className="reset-button" type="button" onClick={() => { setRegion("전체"); setCategory("전체"); setMinPriceManwon(""); setMaxPriceManwon(""); resetVisible(); }}>초기화</button><button className="primary-button" type="button" onClick={() => { setFilterOpen(false); setSavedOnly(false); }}>공고 {noticeTotal}건 보기</button></div>
          </section>
        </div>
      )}

      {detailApplication && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
          <section ref={detailDialogRef} tabIndex={-1} className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" aria-busy={detailLoading}>
            <div className="modal-head"><div><span>OFFICIAL NOTICE</span><h2 id="detail-title">{detailApplication.title}</h2></div><button type="button" onClick={closeDetail} aria-label="닫기"><Icon name="close" /></button></div>
            {detailLoading && <div className="detail-loading" role="status">최신 상세 정보를 확인하고 있어요.</div>}
            {selectedDetail?.contentChangedAt && selectedDetail.lastChangeSummary && (
              <div className="notice-change-banner" role="status">
                <span><Icon name="bell" /></span>
                <div><b>최근 변경된 공고입니다</b><p>{selectedDetail.lastChangeSummary} · {formatChangedAt(selectedDetail.contentChangedAt)}</p></div>
              </div>
            )}
            {selectedChanges.length > 0 && (
              <section className="notice-change-history" aria-labelledby="notice-change-history-title">
                <h3 id="notice-change-history-title">공고 변경 이력</h3>
                <ol>{selectedChanges.map((change) => <li key={change.id}><time dateTime={change.changedAt}>{formatChangedAt(change.changedAt)}</time><span>{change.summary}</span></li>)}</ol>
                <p>변경된 항목을 표시한 기록입니다. 정확한 변경 내용은 공식 공고문을 확인하세요.</p>
              </section>
            )}
            <div className="detail-status"><span className={`state ${detailApplication.stateTone}`}>{detailApplication.state}</span><b>{detailApplication.dday}</b><small>{detailApplication.period}</small></div>
            <div className="detail-grid">
              <div><span>위치</span><strong>{detailApplication.location}</strong></div><div><span>주택 유형</span><strong>{detailApplication.type}</strong></div>
              <div><span>공고일</span><strong>{formatShortDate(detailApplication.noticeDate)}</strong></div><div><span>공급 규모</span><strong>{detailApplication.scale}</strong></div>
              <div><span>{detailApplication.priceLabel}</span><strong>{detailApplication.price}</strong></div><div><span>당첨 발표</span><strong>{formatShortDate(detailApplication.winnerAnnounceDate)}</strong></div>
            </div>
            {selectedDetail && hasExpandedDetails(selectedDetail) && (
              <section className="notice-detail-extra" aria-labelledby="notice-detail-extra-title">
                <h3 id="notice-detail-extra-title">공고 상세정보</h3>
                <dl>
                  <div><dt>공급 구분</dt><dd>{[selectedDetail.housingDetailType, selectedDetail.rentType].filter(Boolean).join(" · ") || "공고문 확인"}</dd></div>
                  <div><dt>입주 예정</dt><dd>{formatMoveInMonth(selectedDetail.moveInPlannedMonth)}</dd></div>
                  <div><dt>특별공급 접수</dt><dd>{optionalPeriod(selectedDetail.specialSupplyStartDate, selectedDetail.specialSupplyEndDate)}</dd></div>
                  <div><dt>계약 기간</dt><dd>{optionalPeriod(selectedDetail.contractStartDate, selectedDetail.contractEndDate)}</dd></div>
                  <div><dt>사업주체</dt><dd>{selectedDetail.businessEntityName || "공고문 확인"}</dd></div>
                  <div><dt>시공사</dt><dd>{selectedDetail.constructionCompanyName || "공고문 확인"}</dd></div>
                  <div><dt>문의처</dt><dd>{selectedDetail.contactPhone ? <a href={`tel:${selectedDetail.contactPhone.replace(/[^0-9+]/g, "")}`}>{selectedDetail.contactPhone}</a> : "공고문 확인"}</dd></div>
                  <div><dt>우편번호</dt><dd>{selectedDetail.postalCode || "공고문 확인"}</dd></div>
                </dl>
                {selectedDetail.homepageUrl && <a className="notice-homepage-link" href={selectedDetail.homepageUrl} target="_blank" rel="noreferrer">분양 홈페이지 열기 <Icon name="arrow" /></a>}
              </section>
            )}
            <div className="eligibility-box"><span className="check-round"><Icon name="check" /></span><div><span>데이터 출처</span><h3>{detailApplication.fit}</h3><p>{detailApplication.deposit} · 본 서비스 정보보다 공식 공고문을 우선합니다.</p></div></div>
            {member && savedIds.has(detailApplication.id) && (
              <section className="favorite-tracker detail-favorite-tracker" aria-label="관심청약 준비 상태">
                <div className="detail-tracker-head"><span>관심청약 준비</span><strong>이 공고의 확인·신청 상태를 바로 기록하세요.</strong></div>
                <div className="detail-tracker-fields">
                  <label>준비 상태
                    <select value={favoriteTrackers.get(detailApplication.id)?.progress ?? "SAVED"} disabled={favoriteTrackerPendingId === detailApplication.id} onChange={(event) => void saveFavoriteTracker(detailApplication.id, event.target.value as FavoriteProgress, favoriteTrackers.get(detailApplication.id)?.memo ?? "")}>
                      {Object.entries(FAVORITE_PROGRESS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>내 메모
                    <input key={`${detailApplication.id}-${favoriteTrackers.get(detailApplication.id)?.updatedAt ?? "new"}`} defaultValue={favoriteTrackers.get(detailApplication.id)?.memo ?? ""} maxLength={500} placeholder="예: 모집공고문 소득 기준 확인" onBlur={(event) => void saveFavoriteTracker(detailApplication.id, favoriteTrackers.get(detailApplication.id)?.progress ?? "SAVED", event.target.value)} />
                  </label>
                </div>
                <div className="favorite-checklist" aria-label="신청 전 확인 항목">
                  <div><span>신청 전 확인</span><strong>{FAVORITE_CHECKLIST_ITEMS.filter(({ key }) => favoriteTrackers.get(detailApplication.id)?.[key]).length}/4 완료</strong></div>
                  <p>체크리스트는 준비를 돕기 위한 개인 기록이며, 실제 자격 판정은 공식 공고문을 확인하세요.</p>
                  <div className="favorite-checklist-options">
                    {FAVORITE_CHECKLIST_ITEMS.map(({ key, label }) => (
                      <label key={key}>
                        <input type="checkbox" checked={favoriteTrackers.get(detailApplication.id)?.[key] ?? false} disabled={favoriteTrackerPendingId === detailApplication.id} onChange={(event) => void saveFavoriteTracker(detailApplication.id, favoriteTrackers.get(detailApplication.id)?.progress ?? "SAVED", favoriteTrackers.get(detailApplication.id)?.memo ?? "", { [key]: event.target.checked })} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            )}
            {member && savedIds.has(detailApplication.id) && (favoriteTrackers.get(detailApplication.id)?.progress ?? "SAVED") === "READY" && (
              <div className="ready-application-actions detail-ready-actions">
                <span><Icon name="check" /> 신청 준비 완료</span>
                <div>
                  {detailApplication.officialUrl ? <a href={detailApplication.officialUrl} target="_blank" rel="noreferrer">공식 공고 열기 <Icon name="arrow" /></a> : <button type="button" disabled>공식 링크 확인 중</button>}
                  <button type="button" onClick={() => void saveFavoriteTracker(detailApplication.id, "APPLIED", favoriteTrackers.get(detailApplication.id)?.memo ?? "")} disabled={favoriteTrackerPendingId === detailApplication.id}>신청 완료로 표시</button>
                </div>
              </div>
            )}
            {member && savedIds.has(detailApplication.id) && (favoriteTrackers.get(detailApplication.id)?.progress ?? "SAVED") === "APPLIED" && (
              <div className="application-result-tracker detail-application-result" aria-label="신청 결과 기록">
                <div><span>신청 결과</span><strong>{FAVORITE_APPLICATION_RESULT_LABELS[favoriteTrackers.get(detailApplication.id)?.applicationResult ?? "PENDING"]}</strong></div>
                <select value={favoriteTrackers.get(detailApplication.id)?.applicationResult ?? "PENDING"} disabled={favoriteTrackerPendingId === detailApplication.id} onChange={(event) => void saveFavoriteTracker(detailApplication.id, "APPLIED", favoriteTrackers.get(detailApplication.id)?.memo ?? "", {}, event.target.value as FavoriteApplicationResult)} aria-label="신청 결과">
                  {Object.entries(FAVORITE_APPLICATION_RESULT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <small>{(favoriteTrackers.get(detailApplication.id)?.applicationResult ?? "PENDING") === "PENDING" ? `당첨 발표일은 ${formatShortDate(detailApplication.winnerAnnounceDate)}입니다.` : `${favoriteTrackers.get(detailApplication.id)?.applicationResultRecordedAt ? `${formatChangedAt(favoriteTrackers.get(detailApplication.id)?.applicationResultRecordedAt ?? "")} 기록` : "공식 당첨자 발표를 기준으로 직접 기록한 결과입니다."}`}</small>
                {(favoriteTrackers.get(detailApplication.id)?.applicationResult ?? "PENDING") !== "PENDING" && <input key={`${detailApplication.id}-${favoriteTrackers.get(detailApplication.id)?.applicationResultRecordedAt ?? "result"}`} defaultValue={favoriteTrackers.get(detailApplication.id)?.applicationResultMemo ?? ""} maxLength={500} placeholder="결과 메모 (예: 계약 일정 확인)" onBlur={(event) => void saveFavoriteTracker(detailApplication.id, "APPLIED", favoriteTrackers.get(detailApplication.id)?.memo ?? "", {}, favoriteTrackers.get(detailApplication.id)?.applicationResult ?? "PENDING", event.target.value)} />}
              </div>
            )}
            <div className="detail-actions"><button type="button" className="secondary-button" onClick={() => void toggleSaved(detailApplication.id)} disabled={favoritePendingId === detailApplication.id}><Icon name="bookmark" /> {savedIds.has(detailApplication.id) ? "관심 해제" : "관심 저장"}</button><button type="button" className="secondary-button" onClick={() => void copyNoticeLink(detailApplication.id)}>링크 복사</button>{detailApplication.officialUrl ? <a className="primary-button" href={detailApplication.officialUrl} target="_blank" rel="noreferrer">공식 공고 보기 <Icon name="arrow" /></a> : <button type="button" className="primary-button" disabled>공식 링크 확인 중</button>}</div>
          </section>
        </div>
      )}

      {comparisonOpen && comparisonNotices.length >= 2 && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComparisonOpen(false); }}>
          <section ref={comparisonDialogRef} tabIndex={-1} className="modal compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
            <div className="modal-head"><div><span>NOTICE COMPARISON</span><h2 id="compare-title">청약 공고 비교</h2></div><button type="button" onClick={() => setComparisonOpen(false)} aria-label="닫기"><Icon name="close" /></button></div>
            <div className="compare-table-wrap">
              <table className="compare-table">
                <caption>선택한 청약 공고 비교</caption>
                <thead><tr><th scope="col">비교 항목</th>{comparisonNotices.map((item) => <th scope="col" key={item.id}><span>{item.category}</span><strong>{item.title}</strong><button type="button" onClick={() => void toggleComparison(item.id)} disabled={comparisonPendingId !== undefined || comparisonResetPending} aria-label={`${item.title} 비교 목록에서 삭제`}><Icon name="close" /></button></th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">지역·위치</th>{comparisonNotices.map((item) => <td key={item.id}><strong>{item.region}</strong><small>{item.location}</small></td>)}</tr>
                  <tr><th scope="row">현재 상태</th>{comparisonNotices.map((item) => <td key={item.id}><span className={`state ${item.stateTone}`}>{item.state}</span><b className="compare-dday">{item.dday}</b></td>)}</tr>
                  <tr><th scope="row">접수 일정</th>{comparisonNotices.map((item) => <td key={item.id}><strong>{item.period}</strong></td>)}</tr>
                  <tr><th scope="row">당첨 발표</th>{comparisonNotices.map((item) => <td key={item.id}><strong>{formatShortDate(item.winnerAnnounceDate)}</strong></td>)}</tr>
                  <tr><th scope="row">가격·보증금</th>{comparisonNotices.map((item) => <td key={item.id}><strong>{item.price}</strong></td>)}</tr>
                  <tr><th scope="row">공급 규모</th>{comparisonNotices.map((item) => <td key={item.id}><strong>{item.scale}</strong></td>)}</tr>
                  <tr><th scope="row">공식 공고</th>{comparisonNotices.map((item) => <td key={item.id}>{item.officialUrl ? <a href={item.officialUrl} target="_blank" rel="noreferrer">원문 확인 <Icon name="arrow" /></a> : <span>링크 확인 중</span>}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="compare-footer"><p>최종 신청 전 공식 공고문의 자격과 일정을 확인하세요.</p><div><button type="button" onClick={copyComparisonLink}>비교 링크 복사</button><button type="button" onClick={() => downloadCalendar(comparisonNotices, "cheongyak-comparison.ics")}><Icon name="calendar" /> 비교 일정 저장</button></div></div>
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
