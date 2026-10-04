// 관심 공고 일정을 검색하고 현재 조회 범위만 캘린더로 저장한다.
import { useEffect, useMemo, useState } from "react";
import { NoticeSummary } from "./api";
import { useDialogAccessibility } from "./useDialogAccessibility";
import { buildNoticeCalendar } from "./noticeTools";
import {
  buildFavoriteCalendarEvents, calendarSelectionNotices, favoriteCalendarEventCounts,
  filterFavoriteCalendarEvents, koreaToday, monthLabel, scheduleDayLabel,
} from "./favoriteCalendarTools";
import type { FavoriteCalendarFilter } from "./favoriteCalendarTools";
import "./favoriteCalendarDialog.css";

interface Props { open: boolean; notices: NoticeSummary[]; onClose: () => void; onOpenNotice: (noticeId: number) => void; }

export default function FavoriteCalendarDialog({ open, notices, onClose, onOpenNotice }: Props) {
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);
  const [filter, setFilter] = useState<FavoriteCalendarFilter>("ALL");
  const [includePast, setIncludePast] = useState(false);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [today, setToday] = useState(koreaToday);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reset = () => { setFilter("ALL"); setIncludePast(false); setQuery(""); setMonth(""); setMessage(""); setError(""); };
  useEffect(() => {
    if (!open) return;
    reset();
    const updateDate = () => { if (document.visibilityState === "visible") setToday(koreaToday()); };
    updateDate();
    const timer = window.setInterval(updateDate, 60_000);
    document.addEventListener("visibilitychange", updateDate);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", updateDate); };
  }, [open]);
  const events = useMemo(() => buildFavoriteCalendarEvents(notices), [notices]);
  const months = useMemo(() => [...new Set(events.map(event => event.date.slice(0, 7)))], [events]);
  const scopedEvents = useMemo(() => filterFavoriteCalendarEvents(events, "ALL", includePast, today, { query, month }), [events, includePast, today, query, month]);
  const visibleEvents = useMemo(() => scopedEvents.filter(event => filter === "ALL" || event.type === filter), [scopedEvents, filter]);
  const counts = useMemo(() => favoriteCalendarEventCounts(scopedEvents), [scopedEvents]);
  const missingCount = new Set(notices.filter(notice => !events.some(event => event.notice.id === notice.id)).map(notice => notice.id)).size;
  const changed = filter !== "ALL" || includePast || Boolean(query) || Boolean(month);
  if (!open) return null;

  const download = () => {
    if (!visibleEvents.length) return;
    setMessage(""); setError("");
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([buildNoticeCalendar(calendarSelectionNotices(visibleEvents))], { type: "text/calendar;charset=utf-8" }));
      anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "cheongyak-filtered-schedule.ics";
      document.body.appendChild(anchor);
      anchor.click();
      setMessage(`현재 표시된 ${visibleEvents.length}개 일정의 파일 다운로드를 요청했어요. 일정 변경 시 다시 저장하고 공식 공고를 확인해주세요.`);
    } catch {
      setError("일정 파일을 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      anchor?.remove();
      if (url) { const objectUrl = url; window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
    }
  };
  let currentMonth = "";
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="modal notification-modal" role="dialog" aria-modal="true" aria-labelledby="favorite-calendar-title">
      <div className="modal-head"><div><span>MY SCHEDULE</span><h2 id="favorite-calendar-title">관심청약 전체 일정</h2></div><button type="button" onClick={onClose} aria-label="닫기">×</button></div>
      <div className="favorite-calendar-toolbar">
        <div className="favorite-calendar-search">
          <label>일정 공고 검색<input type="search" value={query} maxLength={100} placeholder="공고명·지역·주소" onChange={event => setQuery(event.target.value)} /></label>
          <label>일정 월<select aria-label="일정 월" value={month} onChange={event => setMonth(event.target.value)}><option value="">전체 월</option>{months.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}</select></label>
        </div>
        <div className="favorite-calendar-filters" role="group" aria-label="일정 유형 필터">
          {(["ALL", "APPLY_START", "APPLY_END", "WINNER"] as FavoriteCalendarFilter[]).map(value => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? `전체 ${counts.ALL}` : value === "APPLY_START" ? `접수 시작 ${counts.APPLY_START}` : value === "APPLY_END" ? `접수 마감 ${counts.APPLY_END}` : `당첨 발표 ${counts.WINNER}`}</button>)}
        </div>
        <label className="favorite-calendar-past"><input type="checkbox" checked={includePast} onChange={event => setIncludePast(event.target.checked)} />지난 일정도 보기</label>
        <small role="status">한국 날짜 {today} 기준 · 현재 조건 {visibleEvents.length}개 일정</small>
        <div className="favorite-calendar-actions"><button type="button" disabled={!changed} onClick={reset}>조건 초기화</button><button type="button" disabled={!visibleEvents.length} onClick={download}>조회 일정 저장</button></div>
        {missingCount > 0 && <p className="favorite-calendar-note">관심 공고 {missingCount}건은 확인 가능한 일정이 없습니다. 일정 미정 또는 날짜 오류일 수 있으니 공식 공고를 확인해주세요.</p>}
        <p className="favorite-calendar-note">불러온 관심 공고 기준입니다. 저장한 파일은 자동 갱신되지 않으며 최종 일정은 공식 공고를 확인해주세요.</p>
        {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      </div>
      <div className="favorite-calendar-events">
        {visibleEvents.map(event => {
          const nextMonth = monthLabel(event.date);
          const showMonth = nextMonth !== currentMonth;
          currentMonth = nextMonth;
          return <div key={`${event.notice.id}-${event.type}-${event.date}`}>
            {showMonth && <h3 className="favorite-calendar-month">{nextMonth}</h3>}
            <button className="notification-item favorite-calendar-event" type="button" onClick={() => { onOpenNotice(event.notice.id); onClose(); }}><span className="notification-dot" aria-hidden="true"></span><span><b>{event.notice.title}</b><small><time dateTime={event.date}>{event.date.replaceAll("-", ".")}</time> · {scheduleDayLabel(event.date, today)}</small></span><em className={`event-type ${event.type.toLowerCase().replace("_", "-")}`}>{event.label}</em><span aria-hidden="true">›</span></button>
          </div>;
        })}
        {visibleEvents.length === 0 && <div className="notification-empty"><b>{query.trim() || month || filter !== "ALL" ? "조건에 맞는 일정이 없어요" : includePast ? "표시할 일정이 없어요" : "다가오는 일정이 없어요"}</b><p>검색어·월·일정 유형을 바꾸거나 지난 일정도 보기를 선택해 주세요.</p></div>}
      </div>
    </section>
  </div>;
}
