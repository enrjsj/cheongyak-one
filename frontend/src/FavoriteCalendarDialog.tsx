// 관심 공고의 접수·마감·당첨 발표 일정을 날짜순으로 모아 보여준다.
import { NoticeSummary } from "./api";
import { useDialogAccessibility } from "./useDialogAccessibility";

interface Props { open: boolean; notices: NoticeSummary[]; onClose: () => void; onOpenNotice: (noticeId: number) => void; }
type Event = { notice: NoticeSummary; date: string; label: string };

export default function FavoriteCalendarDialog({ open, notices, onClose, onOpenNotice }: Props) {
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);
  if (!open) return null;
  const events: Event[] = notices.flatMap((notice) => [
    notice.applyStartDate && { notice, date: notice.applyStartDate, label: "접수 시작" },
    notice.applyEndDate && { notice, date: notice.applyEndDate, label: "접수 마감" },
    notice.winnerAnnounceDate && { notice, date: notice.winnerAnnounceDate, label: "당첨 발표" },
  ].filter(Boolean) as Event[]).sort((a, b) => a.date.localeCompare(b.date));
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="modal notification-modal" role="dialog" aria-modal="true" aria-labelledby="favorite-calendar-title">
      <div className="modal-head"><div><span>MY SCHEDULE</span><h2 id="favorite-calendar-title">관심청약 전체 일정</h2></div><button type="button" onClick={onClose} aria-label="닫기">×</button></div>
      <div className="notification-inbox">
        {events.map((event) => <button className="notification-item" type="button" key={`${event.notice.id}-${event.label}`} onClick={() => { onOpenNotice(event.notice.id); onClose(); }}><span className="notification-dot"></span><span><b>{event.notice.title}</b><small>{event.label}</small><em>{event.date.replaceAll("-", ".")}</em></span><span>›</span></button>)}
        {events.length === 0 && <div className="notification-empty"><b>표시할 일정이 없어요</b><p>관심 공고의 접수·당첨 발표일을 확인해 주세요.</p></div>}
      </div>
    </section>
  </div>;
}
