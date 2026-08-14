import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchAllNotices,
  fetchNotice,
  HousingCategory,
  NoticeSummary,
  NoticeStatus,
} from "./api";

type StatusKey = "all" | "today" | "open" | "upcoming";
type StateTone = "mint" | "coral" | "blue" | "purple" | "gray";
type PresentationStatus = Exclude<StatusKey, "all"> | "announcement" | "closed";
type IconName = "search" | "pin" | "home" | "calendar" | "bookmark" | "arrow" | "check" | "bell" | "grid" | "close" | "filter";

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

const REGION_ORDER = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const questions = [
  { title: "현재 무주택 세대인가요?", detail: "세대원 전체의 주택 소유 여부를 기준으로 확인해요.", options: ["네, 무주택이에요", "아니요, 주택이 있어요"] },
  { title: "결혼했거나 결혼 예정인가요?", detail: "혼인 7년 이내 또는 예비신혼부부인지 확인해요.", options: ["네, 해당돼요", "아니요"] },
  { title: "생애 처음 주택을 구입하나요?", detail: "본인과 배우자 모두 과거 주택 소유 이력이 없어야 해요.", options: ["네, 처음이에요", "아니요"] },
];

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
  const price = minPrice && maxPrice
    ? `분양가 ${minPrice} — ${maxPrice}`
    : minPrice ? `분양가 ${minPrice}부터` : "분양가는 공고문 확인";
  const category = CATEGORY_LABELS[notice.housingCategory];

  return {
    ...notice,
    ...status,
    location: notice.address || "공급 위치는 공고문 확인",
    region: regionLabel(notice.regionCode, notice.address),
    type: `${category} · 청약홈`,
    category,
    period: formatPeriod(notice.applyStartDate, notice.applyEndDate, notice.winnerAnnounceDate),
    dday: remaining === undefined ? "일정 확인" : remaining === 0 ? "D-DAY" : remaining > 0 ? `D-${remaining}` : "마감",
    price,
    scale: notice.totalUnits ? `총 ${notice.totalUnits.toLocaleString("ko-KR")}세대 공급` : "공급 규모는 공고문 확인",
    fit: "한국부동산원 청약홈 공식 공고",
    deposit: "신청 자격과 예치금은 원문 공고에서 확인",
  };
}

function eventFor(item: Application): { date: string; label: string; tone: string } | undefined {
  const today = koreaToday();
  if (item.applyStartDate && item.applyStartDate >= today) return { date: item.applyStartDate, label: "청약 접수 시작", tone: "blue-dot" };
  if (item.applyEndDate && item.applyEndDate >= today) return { date: item.applyEndDate, label: "청약 접수 마감", tone: "coral-dot" };
  if (item.winnerAnnounceDate && item.winnerAnnounceDate >= today) return { date: item.winnerAnnounceDate, label: "당첨자 발표", tone: "purple-dot" };
  return undefined;
}

export default function Home() {
  const [notices, setNotices] = useState<NoticeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<StatusKey>("all");
  const [region, setRegion] = useState("전체");
  const [category, setCategory] = useState("전체");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<NoticeSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [qualOpen, setQualOpen] = useState(false);
  const [qualStep, setQualStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    fetchAllNotices(controller.signal)
      .then(setNotices)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "청약 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadVersion]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cheongyak-one-saved");
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) setSavedIds(new Set(parsed.filter((id): id is number => typeof id === "number")));
      }
    } catch {
      window.localStorage.removeItem("cheongyak-one-saved");
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
        setSelected(null);
        setQualOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const applications = useMemo(() => notices.map(toApplication), [notices]);
  const availableRegions = useMemo(() => {
    const values = new Set(applications.map((item) => item.region).filter((value) => value !== "지역 미정"));
    return [...values].sort((a, b) => {
      const left = REGION_ORDER.indexOf(a);
      const right = REGION_ORDER.indexOf(b);
      return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || a.localeCompare(b, "ko");
    });
  }, [applications]);
  const availableCategories = useMemo(() => {
    const values = new Set(applications.map((item) => item.category));
    return ["아파트", "오피스텔", "공공임대"].filter((value) => values.has(value));
  }, [applications]);

  const filtered = useMemo(() => applications.filter((item) => {
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || [item.title, item.location, item.type].some((value) => value.toLowerCase().includes(keyword));
    const matchesStatus = activeStatus === "all" || item.statusKey === activeStatus;
    const matchesRegion = region === "전체" || item.region === region;
    const matchesCategory = category === "전체" || item.category === category;
    const matchesSaved = !savedOnly || savedIds.has(item.id);
    return matchesQuery && matchesStatus && matchesRegion && matchesCategory && matchesSaved;
  }), [applications, query, activeStatus, region, category, savedOnly, savedIds]);

  const visible = filtered.slice(0, visibleCount);
  const activeFilterCount = Number(region !== "전체") + Number(category !== "전체");
  const todayCount = applications.filter((item) => item.statusKey === "today").length;
  const openCount = applications.filter((item) => item.statusKey === "open").length;
  const upcomingCount = applications.filter((item) => item.statusKey === "upcoming").length;
  const statuses: { key: StatusKey; label: string; count: number; tone: string; icon: IconName }[] = [
    { key: "all", label: "전체 청약", count: applications.length, tone: "navy", icon: "grid" },
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

  const scrollToResults = () => document.querySelector("#applications")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const resetVisible = () => setVisibleCount(6);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setActiveStatus("all");
    setSavedOnly(false);
    resetVisible();
    scrollToResults();
  };

  const toggleSaved = (id: number) => {
    const next = new Set(savedIds);
    const isSaving = !next.has(id);
    if (isSaving) next.add(id); else next.delete(id);
    setSavedIds(next);
    window.localStorage.setItem("cheongyak-one-saved", JSON.stringify([...next]));
    setToast(isSaving ? "관심청약에 저장했어요." : "관심청약에서 삭제했어요.");
  };

  const applyQuickFilter = (value: string) => {
    setSavedOnly(false);
    setActiveStatus("all");
    resetVisible();
    if (REGION_ORDER.includes(value)) {
      setRegion(value);
      setCategory("전체");
    } else {
      setCategory(value);
      setRegion("전체");
    }
    scrollToResults();
  };

  const openDetail = async (item: Application) => {
    setSelected(item);
    setSelectedDetail(null);
    setDetailLoading(true);
    try {
      setSelectedDetail(await fetchNotice(item.id));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "상세 정보를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  };

  const answerQuestion = (answer: string) => {
    setAnswers((items) => [...items, answer]);
    setQualStep((step) => step + 1);
  };

  const closeQualification = () => {
    setQualOpen(false);
    window.setTimeout(() => { setQualStep(0); setAnswers([]); }, 200);
  };

  const detailApplication = selected ? (selectedDetail ? toApplication(selectedDetail) : selected) : null;

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="청약한눈 홈">
            <span className="brand-mark"><span></span><span></span><span></span></span>
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
              type="button"
              onClick={() => { setSavedOnly((value) => !value); setActiveStatus("all"); resetVisible(); scrollToResults(); }}
              aria-pressed={savedOnly}
            >
              <Icon name="bookmark" /> <span>관심청약</span> <b>{savedIds.size}</b>
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
              <input value={query} onChange={(event) => { setQuery(event.target.value); resetVisible(); }} placeholder="지역 또는 단지명을 검색해보세요" aria-label="청약 검색어" />
              {query && <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><Icon name="close" /></button>}
            </label>
            <button className="search-submit" type="submit">청약 찾기 <Icon name="arrow" /></button>
          </form>
          <div className="quick-filters">
            <span>빠른 검색</span>
            {["서울", "경기", "아파트", "오피스텔"].map((item) => <button type="button" key={item} onClick={() => applyQuickFilter(item)}>{item}</button>)}
          </div>
        </div>

        <aside className="week-card" aria-label="이번 주 청약 요약">
          <div className="week-card-head">
            <div><span className="mini-label">{thisMonth}월 {Math.ceil(thisDay / 7)}주차</span><h2>이번 주 청약</h2></div>
            <span className="live-dot">LIVE</span>
          </div>
          <div className="week-stats">
            <div><strong>{openCount}</strong><span>접수중</span></div>
            <div><strong>{todayCount}</strong><span>오늘 마감</span></div>
            <div><strong>{upcomingCount}</strong><span>오픈 예정</span></div>
          </div>
          {highlight && highlightEvent ? (
            <button className="next-event" type="button" onClick={() => openDetail(highlight)}>
              <span className="date-box"><strong>{Number(highlightEvent.date.slice(8))}</strong><span>{weekday(highlightEvent.date)}</span></span>
              <span><small>{highlightEvent.label}</small><b>{highlight.title}</b></span>
              <Icon name="arrow" />
            </button>
          ) : (
            <div className="next-event no-event"><span>새로운 접수 일정을 확인 중입니다.</span></div>
          )}
          <p className="data-note">청약홈 실데이터 · {syncedLabel} 기준</p>
        </aside>
      </section>

      <section className="dashboard" id="applications">
        <div className="status-tabs" role="tablist" aria-label="청약 상태">
          {statuses.map((status) => (
            <button className={activeStatus === status.key ? "selected" : ""} type="button" role="tab" aria-selected={activeStatus === status.key} key={status.key} onClick={() => { setActiveStatus(status.key); setSavedOnly(false); resetVisible(); }}>
              <span className={`tab-icon ${status.tone}`}><Icon name={status.icon} /></span><span>{status.label}<b>{loading ? "–" : status.count}</b></span>
            </button>
          ))}
        </div>

        <div className="content-grid">
          <div className="list-panel">
            <div className="section-head">
              <div>
                <span className="section-kicker">{savedOnly ? "MY SAVED" : "REAL-TIME NOTICES"}</span>
                <h2>{savedOnly ? "관심 청약" : "지금 확인할 청약"}</h2>
                <p className="result-summary" aria-live="polite">{loading ? "실제 공고를 불러오는 중" : `조건에 맞는 공고 ${filtered.length}건`}</p>
              </div>
              <button className="filter-button" type="button" onClick={() => setFilterOpen(true)} disabled={loading}><Icon name="filter" /> 지역·유형 필터 {activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
            </div>

            {loading ? (
              <div className="list-loading" role="status" aria-label="청약 공고 불러오는 중">
                {[0, 1, 2].map((item) => <div className="list-skeleton" key={item}><i></i><strong></strong><span></span><small></small></div>)}
              </div>
            ) : loadError ? (
              <div className="inline-error" role="alert">
                <span>!</span><h3>공고를 불러오지 못했어요</h3><p>{loadError}</p>
                <button type="button" onClick={() => setLoadVersion((version) => version + 1)}>다시 불러오기</button>
              </div>
            ) : visible.length > 0 ? (
              <>
                <div className="application-list">
                  {visible.map((item) => (
                    <article className="application-card" key={item.id}>
                      <div className="card-topline">
                        <div className="tags"><span className={`state ${item.stateTone}`}>{item.state}</span><span className="type-tag">{item.type}</span></div>
                        <button className={`bookmark ${savedIds.has(item.id) ? "saved" : ""}`} type="button" onClick={() => toggleSaved(item.id)} aria-label={`${item.title} 관심청약 ${savedIds.has(item.id) ? "해제" : "저장"}`} aria-pressed={savedIds.has(item.id)}><Icon name="bookmark" /></button>
                      </div>
                      <div className="card-main">
                        <div><h3>{item.title}</h3><p className="location"><Icon name="pin" /> {item.location}</p></div>
                        <div className="deadline"><strong>{item.dday}</strong><span>{item.period}</span></div>
                      </div>
                      <div className="card-facts"><span>{item.price}</span><i></i><span>{item.scale}</span><i></i><span>{item.region}</span></div>
                      <button className="detail-link" type="button" onClick={() => openDetail(item)}>공고 핵심만 보기 <Icon name="arrow" /></button>
                    </article>
                  ))}
                </div>
                {filtered.length > visibleCount && <button className="more-button" type="button" onClick={() => setVisibleCount((count) => count + 6)}>다음 {Math.min(6, filtered.length - visibleCount)}건 더보기 <Icon name="arrow" /></button>}
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><Icon name={savedOnly ? "bookmark" : "search"} /></span>
                <h3>{savedOnly ? "저장한 관심청약이 없어요" : "조건에 맞는 공고가 없어요"}</h3>
                <p>{savedOnly ? "관심 있는 공고의 북마크를 눌러 모아보세요." : "검색어나 지역·유형 필터를 조금 넓혀보세요."}</p>
                <button type="button" onClick={() => { setQuery(""); setRegion("전체"); setCategory("전체"); setActiveStatus("all"); setSavedOnly(false); resetVisible(); }}>전체 청약 보기</button>
              </div>
            )}
          </div>

          <aside className="side-column">
            <section className="plan-card" id="guide">
              <div className="plan-head">
                <span className="plan-illustration"></span>
                <div><span>나에게 맞는 청약 찾기</span><h2>3분 자격 체크</h2></div>
              </div>
              <p>몇 가지 질문으로 확인해야 할 특별공급 유형을 간단히 좁혀보세요.</p>
              <ul><li><Icon name="check" /> 무주택 기간</li><li><Icon name="check" /> 청약통장 조건</li><li><Icon name="check" /> 소득·자산 기준</li></ul>
              <button type="button" onClick={() => setQualOpen(true)}>무료로 확인하기 <Icon name="arrow" /></button>
            </section>

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
        <button type="button" onClick={() => { setSavedOnly(true); setActiveStatus("all"); resetVisible(); scrollToResults(); }}><Icon name="bookmark" /><span>관심</span></button>
      </nav>

      {filterOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFilterOpen(false); }}>
          <section className="modal filter-modal" role="dialog" aria-modal="true" aria-labelledby="filter-title">
            <div className="modal-head"><div><span>FILTER</span><h2 id="filter-title">청약 조건 선택</h2></div><button type="button" onClick={() => setFilterOpen(false)} aria-label="닫기"><Icon name="close" /></button></div>
            <div className="filter-group"><h3>지역</h3><div className="choice-grid">{["전체", ...availableRegions].map((item) => <button className={region === item ? "active" : ""} type="button" key={item} onClick={() => { setRegion(item); resetVisible(); }}>{item}</button>)}</div></div>
            <div className="filter-group"><h3>주택 유형</h3><div className="choice-grid">{["전체", ...availableCategories].map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => { setCategory(item); resetVisible(); }}>{item}</button>)}</div></div>
            <div className="modal-actions"><button className="reset-button" type="button" onClick={() => { setRegion("전체"); setCategory("전체"); resetVisible(); }}>초기화</button><button className="primary-button" type="button" onClick={() => { setFilterOpen(false); setSavedOnly(false); }}>공고 {filtered.length}건 보기</button></div>
          </section>
        </div>
      )}

      {detailApplication && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" aria-busy={detailLoading}>
            <div className="modal-head"><div><span>OFFICIAL NOTICE</span><h2 id="detail-title">{detailApplication.title}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="닫기"><Icon name="close" /></button></div>
            {detailLoading && <div className="detail-loading" role="status">최신 상세 정보를 확인하고 있어요.</div>}
            <div className="detail-status"><span className={`state ${detailApplication.stateTone}`}>{detailApplication.state}</span><b>{detailApplication.dday}</b><small>{detailApplication.period}</small></div>
            <div className="detail-grid">
              <div><span>위치</span><strong>{detailApplication.location}</strong></div><div><span>주택 유형</span><strong>{detailApplication.type}</strong></div>
              <div><span>공고일</span><strong>{formatShortDate(detailApplication.noticeDate)}</strong></div><div><span>공급 규모</span><strong>{detailApplication.scale}</strong></div>
              <div><span>분양가</span><strong>{detailApplication.price}</strong></div><div><span>당첨 발표</span><strong>{formatShortDate(detailApplication.winnerAnnounceDate)}</strong></div>
            </div>
            <div className="eligibility-box"><span className="check-round"><Icon name="check" /></span><div><span>데이터 출처</span><h3>{detailApplication.fit}</h3><p>{detailApplication.deposit} · 본 서비스 정보보다 공식 공고문을 우선합니다.</p></div></div>
            <div className="detail-actions"><button type="button" className="secondary-button" onClick={() => toggleSaved(detailApplication.id)}><Icon name="bookmark" /> {savedIds.has(detailApplication.id) ? "관심 해제" : "관심 저장"}</button>{detailApplication.officialUrl ? <a className="primary-button" href={detailApplication.officialUrl} target="_blank" rel="noreferrer">공식 공고 보기 <Icon name="arrow" /></a> : <button type="button" className="primary-button" disabled>공식 링크 확인 중</button>}</div>
          </section>
        </div>
      )}

      {qualOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQualification(); }}>
          <section className="modal qualify-modal" role="dialog" aria-modal="true" aria-labelledby="qual-title">
            <div className="modal-head"><div><span>QUICK CHECK</span><h2 id="qual-title">청약 자격 체크</h2></div><button type="button" onClick={closeQualification} aria-label="닫기"><Icon name="close" /></button></div>
            {qualStep < questions.length ? (
              <div className="question-area">
                <div className="progress"><i style={{ width: `${((qualStep + 1) / questions.length) * 100}%` }}></i></div>
                <small>{qualStep + 1} / {questions.length}</small>
                <h3>{questions[qualStep].title}</h3>
                <p>{questions[qualStep].detail}</p>
                <div className="answer-buttons">{questions[qualStep].options.map((option) => <button type="button" key={option} onClick={() => answerQuestion(option)}>{option}<Icon name="arrow" /></button>)}</div>
                {qualStep > 0 && <button className="back-button" type="button" onClick={() => { setQualStep((step) => step - 1); setAnswers((items) => items.slice(0, -1)); }}>이전 질문</button>}
              </div>
            ) : (
              <div className="result-area">
                <span className="result-icon"><Icon name="check" /></span>
                <small>간편 진단 결과</small>
                <h3>{answers[0]?.startsWith("네") ? "확인해볼 특별공급이 있어요" : "일반공급 조건부터 확인해보세요"}</h3>
                <p>{answers[1]?.startsWith("네") ? "신혼부부 특별공급" : "일반공급"}{answers[2]?.startsWith("네") ? "과 생애최초 특별공급" : ""} 자격을 공식 공고문에서 확인해보세요. 이 결과는 간편 안내이며 신청 가능 여부를 보장하지 않아요.</p>
                <button className="primary-button" type="button" onClick={() => { closeQualification(); scrollToResults(); }}>실제 공고 보기 <Icon name="arrow" /></button>
              </div>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><Icon name="check" /> {toast}</div>}
    </main>
  );
}
