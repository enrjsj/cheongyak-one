// 관심 공고의 접수·마감·당첨 발표 일정을 날짜순으로 모아 보여준다.
import { useMemo, useState } from "react";
import { NoticeSummary } from "./api";
import { useDialogAccessibility } from "./useDialogAccessibility";
import {
  buildFavoriteCalendarEvents,
  favoriteCalendarEventCounts,
  filterFavoriteCalendarEvents,
  monthLabel,
} from "./favoriteCalendarTools";
import type { FavoriteCalendarFilter } from "./favoriteCalendarTools";
import "./favoriteCalendarDialog.css";

interface Props { open: boolean; notices: NoticeSummary[]; onClose: () => void; onOpenNotice: (noticeId: number) => void; }

function koreaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export default function FavoriteCalendarDialog({ open, notices, onClose, onOpenNotice }: Props) {
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);
  const [filter, setFilter] = useState<FavoriteCalendarFilter>("ALL");
  const [includePast, setIncludePast] = useState(false);
  const events = useMemo(() => buildFavoriteCalendarEvents(notices), [notices]);
  const visibleEvents = useMemo(() => filterFavoriteCalendarEvents(events, filter, includePast, koreaToday()), [events, filter, includePast]);
  const counts = useMemo(() => favoriteCalendarEventCounts(events), [events]);
  if (!open) return null;
  let currentMonth = "";
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="modal notification-modal" role="dialog" aria-modal="true" aria-labelledby="favorite-calendar-title">
      <div className="modal-head"><div><span>MY SCHEDULE</span><h2 id="favorite-calendar-title">관심청약 전체 일정</h2></div><button type="button" onClick={onClose} aria-label="닫기">×</button></div>
      <div className="favorite-calendar-toolbar">
        <div className="favorite-calendar-filters" role="group" aria-label="일정 유형 필터">
          {(["ALL", "APPLY_START", "APPLY_END", "WINNER"] as FavoriteCalendarFilter[]).map((value) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "ALL" ? `전체 ${counts.ALL}` : value === "APPLY_START" ? `접수 시작 ${counts.APPLY_START}` : value === "APPLY_END" ? `접수 마감 ${counts.APPLY_END}` : `당첨 발표 ${counts.WINNER}`}</button>)}
        </div>
        <label className="favorite-calendar-past"><input type="checkbox" checked={includePast} onChange={(event) => setIncludePast(event.target.checked)} />지난 일정도 보기</label>
      </div>
      <div className="favorite-calendar-events">
        {visibleEvents.map((event) => {
          const nextMonth = monthLabel(event.date);
          const showMonth = nextMonth !== currentMonth;
          currentMonth = nextMonth;
          return <div key={`${event.notice.id}-${event.type}-${event.date}`}>
            {showMonth && <h3 className="favorite-calendar-month">{nextMonth}</h3>}
            <button className="notification-item favorite-calendar-event" type="button" onClick={() => { onOpenNotice(event.notice.id); onClose(); }}><span className="notification-dot"></span><span><b>{event.notice.title}</b><small>{event.date.replaceAll("-", ".")}</small></span><em className={`event-type ${event.type.toLowerCase().replace("_", "-")}`}>{event.label}</em><span>›</span></button>
          </div>;
        })}
        {visibleEvents.length === 0 && <div className="notification-empty"><b>{includePast ? "표시할 일정이 없어요" : "다가오는 일정이 없어요"}</b><p>{includePast ? "관심 공고의 접수·당첨 발표일을 확인해 주세요." : "지난 일정도 보기로 전환하면 전체 이력을 볼 수 있어요."}</p></div>}
      </div>
    </section>
  </div>;
}
