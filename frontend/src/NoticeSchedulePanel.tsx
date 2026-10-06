import { useEffect, useState } from "react";
import type { NoticeDetail } from "./api";
import { buildDetailCalendar, noticeSchedule, noticeScheduleStatus } from "./noticeTools";
import type { NoticeScheduleKind } from "./noticeTools";
import { koreaToday } from "./favoriteCalendarTools";
import "./noticeSchedule.css";

export default function NoticeSchedulePanel({ notice }: { notice: NoticeDetail }) {
  const stages = noticeSchedule(notice);
  const [today, setToday] = useState(koreaToday);
  const [selected, setSelected] = useState<NoticeScheduleKind[]>(() => noticeSchedule(notice).filter(item => !item.issue).map(item => item.kind));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setToday(koreaToday());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const valid = stages.filter(item => !item.issue);
  const selectedCount = valid.filter(item => selected.includes(item.kind)).length;
  function select(kinds: NoticeScheduleKind[]) { setSelected(kinds); setMessage(""); setError(""); }
  function download() {
    setMessage(""); setError("");
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([buildDetailCalendar(notice, selected)], { type: "text/calendar;charset=utf-8" }));
      anchor = document.createElement("a");
      anchor.href = url; anchor.download = `cheongyak-notice-${notice.id}-schedule.ics`;
      document.body.append(anchor); anchor.click();
      setMessage(`선택한 ${selectedCount}개 일정의 캘린더 파일 저장을 요청했습니다.`);
    } catch { setError("일정 파일을 만들지 못했습니다. 선택은 유지되니 다시 시도해주세요."); }
    finally {
      anchor?.remove();
      if (url) { const objectUrl = url; window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000); }
    }
  }
  return <section className="notice-schedule" aria-labelledby="notice-schedule-title">
    <h3 id="notice-schedule-title">핵심 일정 타임라인</h3>
    <p>한국 날짜 {today} 기준입니다. 실제 접수 시간·순위별 일정과 계약 대상은 공식 공고를 확인하세요.</p>
    <ol>{stages.map(item => <li key={item.kind}>
      <label>
        <input type="checkbox" aria-label={`${item.label} 일정 선택`} disabled={Boolean(item.issue)} checked={!item.issue && selected.includes(item.kind)} onChange={event => select(event.target.checked ? [...selected, item.kind] : selected.filter(kind => kind !== item.kind))} />
        <span><strong>{item.label}</strong><span className="notice-schedule-dates">{item.start ? <time dateTime={item.start}>{item.start}</time> : item.kind === "WINNER" ? "발표일 미확인" : "시작일 미확인"}{item.kind !== "WINNER" && <> ~ {item.end ? <time dateTime={item.end}>{item.end}</time> : "종료일 미확인"}</>}</span></span>
      </label>
      <span className={`notice-schedule-status${item.issue ? " unconfirmed" : ""}`}>{item.issue ?? noticeScheduleStatus(item, today)}</span>
    </li>)}</ol>
    <p>날짜 미확인·오류가 있는 일정은 파일에 넣지 않습니다. 저장 가능한 일정 {valid.length}개 중 {selectedCount}개 선택.</p>
    <div className="notice-schedule-actions">
      <button type="button" disabled={!valid.length || selectedCount === valid.length} onClick={() => select(valid.map(item => item.kind))}>일정 전체 선택</button>
      <button type="button" disabled={!selectedCount} onClick={() => select([])}>일정 선택 해제</button>
      <button className="secondary-button" type="button" disabled={!selectedCount} onClick={download}>선택 일정 저장 (.ics)</button>
    </div>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <small>기기의 캘린더에서 파일을 열어 가져오세요. 종일 일정이며 알림 시간은 캘린더 앱에서 설정합니다. 파일은 자동 갱신되지 않으며 다시 가져오면 앱에 따라 중복될 수 있습니다. 선택은 상세 창을 닫으면 초기화됩니다.</small>
  </section>;
}
