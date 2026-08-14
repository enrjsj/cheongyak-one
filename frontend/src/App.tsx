import { FormEvent, useEffect, useMemo, useState } from "react";

type StatusKey = "all" | "today" | "open" | "upcoming";
type Application = {
  id: number;
  state: string;
  stateTone: "mint" | "coral" | "blue" | "purple";
  statusKey: Exclude<StatusKey, "all"> | "announcement";
  title: string;
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

const applications: Application[] = [
  {
    id: 1, state: "접수중", stateTone: "mint", statusKey: "open",
    title: "서초 리버파크", location: "서울 서초구", region: "서울",
    type: "민영 · 일반공급", category: "일반공급", period: "8. 13. — 8. 16.", dday: "D-2",
    price: "분양가 12.8억부터", scale: "총 324세대 · 일반 86세대", fit: "서울 2년 이상 우선", deposit: "청약통장 24개월 이상",
  },
  {
    id: 2, state: "오늘 마감", stateTone: "coral", statusKey: "today",
    title: "고양 창릉 A4블록", location: "경기 고양시", region: "경기",
    type: "공공 · 신혼희망타운", category: "신혼부부", period: "8. 12. — 8. 14.", dday: "D-DAY",
    price: "추정 분양가 5.4억", scale: "총 603세대 · 일반 412세대", fit: "신혼부부 · 예비신혼부부", deposit: "입주자저축 6회 이상",
  },
  {
    id: 3, state: "오픈 예정", stateTone: "blue", statusKey: "upcoming",
    title: "인천 검단 센트럴", location: "인천 서구", region: "인천",
    type: "민영 · 특별공급", category: "생애최초", period: "8. 20. — 8. 22.", dday: "D-6",
    price: "분양가 6.1억부터", scale: "총 721세대 · 일반 204세대", fit: "수도권 거주자 신청 가능", deposit: "청약통장 12개월 이상",
  },
  {
    id: 4, state: "발표 예정", stateTone: "purple", statusKey: "announcement",
    title: "마곡 엠밸리 17단지", location: "서울 강서구", region: "서울",
    type: "공공 · 일반공급", category: "일반공급", period: "당첨 발표 8. 27.", dday: "D-13",
    price: "추정 분양가 7.9억", scale: "총 308세대 · 일반 122세대", fit: "서울 거주자 우선", deposit: "납입 인정금액 순",
  },
  {
    id: 5, state: "접수중", stateTone: "mint", statusKey: "open",
    title: "광명 뉴타운 포레나", location: "경기 광명시", region: "경기",
    type: "민영 · 특별공급", category: "생애최초", period: "8. 14. — 8. 18.", dday: "D-4",
    price: "분양가 8.3억부터", scale: "총 585세대 · 일반 176세대", fit: "생애최초 34세대", deposit: "지역별 예치금 충족",
  },
  {
    id: 6, state: "오픈 예정", stateTone: "blue", statusKey: "upcoming",
    title: "부산 에코델타 6블록", location: "부산 강서구", region: "부산",
    type: "공공 · 신혼부부", category: "신혼부부", period: "8. 25. — 8. 28.", dday: "D-11",
    price: "추정 분양가 4.7억", scale: "총 952세대 · 일반 613세대", fit: "부산·울산·경남 거주", deposit: "입주자저축 6회 이상",
  },
];

const statuses: { key: StatusKey; label: string; count: number; tone: string; icon: IconName }[] = [
  { key: "all", label: "전체 청약", count: 6, tone: "navy", icon: "grid" },
  { key: "today", label: "오늘 마감", count: 1, tone: "coral", icon: "bell" },
  { key: "open", label: "접수중", count: 2, tone: "mint", icon: "check" },
  { key: "upcoming", label: "오픈 예정", count: 2, tone: "blue", icon: "calendar" },
];

const questions = [
  { title: "현재 무주택 세대인가요?", detail: "세대원 전체의 주택 소유 여부를 기준으로 확인해요.", options: ["네, 무주택이에요", "아니요, 주택이 있어요"] },
  { title: "결혼했거나 결혼 예정인가요?", detail: "혼인 7년 이내 또는 예비신혼부부인지 확인해요.", options: ["네, 해당돼요", "아니요"] },
  { title: "생애 처음 주택을 구입하나요?", detail: "본인과 배우자 모두 과거 주택 소유 이력이 없어야 해요.", options: ["네, 처음이에요", "아니요"] },
];

type IconName = "search" | "pin" | "home" | "calendar" | "bookmark" | "arrow" | "check" | "bell" | "grid" | "close" | "filter";

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

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<StatusKey>("all");
  const [region, setRegion] = useState("전체");
  const [category, setCategory] = useState("전체");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [qualOpen, setQualOpen] = useState(false);
  const [qualStep, setQualStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("cheongyak-one-saved");
      if (saved) setSavedIds(new Set(JSON.parse(saved) as number[]));
    }, 0);
    return () => window.clearTimeout(timer);
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

  const filtered = useMemo(() => applications.filter((item) => {
    const keyword = query.trim().toLowerCase();
    const matchesQuery = !keyword || [item.title, item.location, item.type, item.category].some((value) => value.toLowerCase().includes(keyword));
    const matchesStatus = activeStatus === "all" || item.statusKey === activeStatus;
    const matchesRegion = region === "전체" || item.region === region;
    const matchesCategory = category === "전체" || item.category === category;
    const matchesSaved = !savedOnly || savedIds.has(item.id);
    return matchesQuery && matchesStatus && matchesRegion && matchesCategory && matchesSaved;
  }), [query, activeStatus, region, category, savedOnly, savedIds]);

  const visible = showAll ? filtered : filtered.slice(0, 3);
  const activeFilterCount = Number(region !== "전체") + Number(category !== "전체");

  const scrollToResults = () => document.querySelector("#applications")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setActiveStatus("all"); setSavedOnly(false); scrollToResults(); };

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
    if (["서울", "경기"].includes(value)) {
      setRegion(value);
      setCategory("전체");
    } else {
      setCategory(value);
      setRegion("전체");
    }
    scrollToResults();
  };

  const answerQuestion = (answer: string) => {
    const next = [...answers, answer];
    setAnswers(next);
    setQualStep((step) => step + 1);
  };

  const closeQualification = () => {
    setQualOpen(false);
    window.setTimeout(() => { setQualStep(0); setAnswers([]); }, 200);
  };

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
            <span className="demo-chip">DEMO</span>
            <button
              className={`saved-button ${savedOnly ? "active" : ""}`}
              type="button"
              onClick={() => { setSavedOnly((value) => !value); setActiveStatus("all"); scrollToResults(); }}
              aria-pressed={savedOnly}
            >
              <Icon name="bookmark" /> <span>관심청약</span> <b>{savedIds.size}</b>
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span></span> 복잡한 청약, 이제 쉽게</div>
          <h1>내 조건에 맞는 청약만,<br/><em>한눈에.</em></h1>
          <p>흩어진 모집공고를 일일이 찾지 마세요.<br/>지역과 조건을 고르면 중요한 일정부터 자격까지 정리해드려요.</p>
          <form className="search-box" role="search" onSubmit={submitSearch}>
            <label className="search-field">
              <Icon name="search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역 또는 단지명을 검색해보세요" aria-label="청약 검색어" />
              {query && <button className="clear-search" type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><Icon name="close" /></button>}
            </label>
            <button className="search-submit" type="submit">청약 찾기 <Icon name="arrow" /></button>
          </form>
          <div className="quick-filters">
            <span>빠른 검색</span>
            {["서울", "경기", "신혼부부", "생애최초"].map((item) => <button type="button" key={item} onClick={() => applyQuickFilter(item)}>{item}</button>)}
          </div>
        </div>

        <aside className="week-card" aria-label="이번 주 청약 요약">
          <div className="week-card-head">
            <div><span className="mini-label">8월 2주차</span><h2>이번 주 청약</h2></div>
            <span className="live-dot">LIVE</span>
          </div>
          <div className="week-stats">
            <div><strong>7</strong><span>접수중</span></div>
            <div><strong>2</strong><span>오늘 마감</span></div>
            <div><strong>13</strong><span>오픈 예정</span></div>
          </div>
          <button className="next-event" type="button" onClick={() => { setActiveStatus("today"); scrollToResults(); }}>
            <span className="date-box"><strong>14</strong><span>금</span></span>
            <span><small>오늘 마감</small><b>고양 창릉 A4블록 외 1건</b></span>
            <Icon name="arrow" />
          </button>
          <p className="data-note">실제 연동 전 화면 확인용 예시 데이터입니다.</p>
        </aside>
      </section>

      <section className="dashboard" id="applications">
        <div className="status-tabs" role="tablist" aria-label="청약 상태">
          {statuses.map((status) => (
            <button className={activeStatus === status.key ? "selected" : ""} type="button" role="tab" aria-selected={activeStatus === status.key} key={status.key} onClick={() => { setActiveStatus(status.key); setSavedOnly(false); setShowAll(false); }}>
              <span className={`tab-icon ${status.tone}`}><Icon name={status.icon} /></span><span>{status.label}<b>{status.count}</b></span>
            </button>
          ))}
        </div>

        <div className="content-grid">
          <div className="list-panel">
            <div className="section-head">
              <div>
                <span className="section-kicker">{savedOnly ? "MY SAVED" : "RECOMMENDED"}</span>
                <h2>{savedOnly ? "관심 청약" : "지금 확인할 청약"}</h2>
                <p className="result-summary" aria-live="polite">조건에 맞는 공고 {filtered.length}건</p>
              </div>
              <button className="filter-button" type="button" onClick={() => setFilterOpen(true)}><Icon name="filter" /> 지역·유형 필터 {activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
            </div>

            {visible.length > 0 ? (
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
                      <div className="card-facts"><span>{item.price}</span><i></i><span>{item.scale}</span><i></i><span>{item.fit}</span></div>
                      <button className="detail-link" type="button" onClick={() => setSelected(item)}>공고 핵심만 보기 <Icon name="arrow" /></button>
                    </article>
                  ))}
                </div>
                {filtered.length > 3 && <button className="more-button" type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? "간단히 보기" : `나머지 ${filtered.length - 3}건 더보기`} <Icon name="arrow" /></button>}
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><Icon name={savedOnly ? "bookmark" : "search"} /></span>
                <h3>{savedOnly ? "저장한 관심청약이 없어요" : "조건에 맞는 공고가 없어요"}</h3>
                <p>{savedOnly ? "관심 있는 공고의 북마크를 눌러 모아보세요." : "검색어나 지역·유형 필터를 조금 넓혀보세요."}</p>
                <button type="button" onClick={() => { setQuery(""); setRegion("전체"); setCategory("전체"); setActiveStatus("all"); setSavedOnly(false); }}>전체 청약 보기</button>
              </div>
            )}
          </div>

          <aside className="side-column">
            <section className="plan-card" id="guide">
              <div className="plan-head">
                <span className="plan-illustration"></span>
                <div><span>나에게 맞는 청약 찾기</span><h2>3분 자격 체크</h2></div>
              </div>
              <p>몇 가지 질문에 답하면 신청 가능한 특별공급과 우선순위를 알려드려요.</p>
              <ul><li><Icon name="check" /> 무주택 기간</li><li><Icon name="check" /> 청약통장 조건</li><li><Icon name="check" /> 소득·자산 기준</li></ul>
              <button type="button" onClick={() => setQualOpen(true)}>무료로 확인하기 <Icon name="arrow" /></button>
            </section>

            <section className="schedule-card" id="schedule">
              <div className="side-title"><div><span>MY SCHEDULE</span><h2>다가오는 일정</h2></div><button type="button" onClick={() => { setActiveStatus("all"); scrollToResults(); }}>전체보기</button></div>
              <ol>
                <li><div className="timeline-date"><strong>14</strong><span>오늘</span></div><div><b>고양 창릉 A4블록</b><span>청약 접수 마감</span></div><i className="coral-dot"></i></li>
                <li><div className="timeline-date"><strong>20</strong><span>수</span></div><div><b>인천 검단 센트럴</b><span>특별공급 접수</span></div><i className="blue-dot"></i></li>
                <li><div className="timeline-date"><strong>27</strong><span>수</span></div><div><b>마곡 엠밸리 17단지</b><span>당첨자 발표</span></div><i className="purple-dot"></i></li>
              </ol>
            </section>
          </aside>
        </div>
      </section>

      <footer><div className="footer-inner"><span>청약한눈</span><p>놓치지 말아야 할 청약 정보를 가장 쉽게.</p><small>화면 내 단지와 일정은 프로토타입용 예시입니다.</small></div></footer>

      <nav className="mobile-nav" aria-label="모바일 메뉴">
        <a className="active" href="#top"><Icon name="home" /><span>홈</span></a>
        <a href="#applications"><Icon name="search" /><span>청약찾기</span></a>
        <a href="#schedule"><Icon name="calendar" /><span>일정</span></a>
        <button type="button" onClick={() => { setSavedOnly(true); setActiveStatus("all"); scrollToResults(); }}><Icon name="bookmark" /><span>관심</span></button>
      </nav>

      {filterOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFilterOpen(false); }}>
          <section className="modal filter-modal" role="dialog" aria-modal="true" aria-labelledby="filter-title">
            <div className="modal-head"><div><span>FILTER</span><h2 id="filter-title">청약 조건 선택</h2></div><button type="button" onClick={() => setFilterOpen(false)} aria-label="닫기"><Icon name="close" /></button></div>
            <div className="filter-group"><h3>지역</h3><div className="choice-grid">{["전체", "서울", "경기", "인천", "부산"].map((item) => <button className={region === item ? "active" : ""} type="button" key={item} onClick={() => setRegion(item)}>{item}</button>)}</div></div>
            <div className="filter-group"><h3>공급 유형</h3><div className="choice-grid">{["전체", "일반공급", "신혼부부", "생애최초"].map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
            <div className="modal-actions"><button className="reset-button" type="button" onClick={() => { setRegion("전체"); setCategory("전체"); }}>초기화</button><button className="primary-button" type="button" onClick={() => { setFilterOpen(false); setSavedOnly(false); setShowAll(false); }}>공고 {filtered.length}건 보기</button></div>
          </section>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="modal-head"><div><span>NOTICE SUMMARY</span><h2 id="detail-title">{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="닫기"><Icon name="close" /></button></div>
            <div className="detail-status"><span className={`state ${selected.stateTone}`}>{selected.state}</span><b>{selected.dday}</b><small>{selected.period}</small></div>
            <div className="detail-grid">
              <div><span>위치</span><strong>{selected.location}</strong></div><div><span>공급</span><strong>{selected.type}</strong></div>
              <div><span>가격</span><strong>{selected.price}</strong></div><div><span>규모</span><strong>{selected.scale}</strong></div>
            </div>
            <div className="eligibility-box"><span className="check-round"><Icon name="check" /></span><div><span>핵심 자격</span><h3>{selected.fit}</h3><p>{selected.deposit} · 세부 조건은 반드시 원문 공고에서 확인하세요.</p></div></div>
            <div className="detail-actions"><button type="button" className="secondary-button" onClick={() => toggleSaved(selected.id)}><Icon name="bookmark" /> {savedIds.has(selected.id) ? "관심 해제" : "관심 저장"}</button><button type="button" className="primary-button" onClick={() => setToast("공식 공고 연결은 데이터 연동 후 제공돼요.")}>공식 공고 보기 <Icon name="arrow" /></button></div>
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
                <h3>{answers[0]?.startsWith("네") ? "신청 가능한 유형이 있어요" : "일반공급 조건부터 확인해보세요"}</h3>
                <p>{answers[1]?.startsWith("네") ? "신혼부부 특별공급" : "일반공급"}{answers[2]?.startsWith("네") ? "과 생애최초 특별공급" : ""}을 우선 확인해보세요. 정확한 자격은 공고문과 관계기관에서 다시 확인해야 해요.</p>
                <button className="primary-button" type="button" onClick={() => { closeQualification(); setCategory(answers[1]?.startsWith("네") ? "신혼부부" : "전체"); scrollToResults(); }}>추천 공고 보기 <Icon name="arrow" /></button>
              </div>
            )}
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><Icon name="check" /> {toast}</div>}
    </main>
  );
}
