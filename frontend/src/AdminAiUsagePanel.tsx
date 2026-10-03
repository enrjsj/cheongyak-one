import { useEffect, useState } from "react";
import { fetchAdminAiUsage } from "./api";
import type { AiUsageDay } from "./api";

export default function AdminAiUsagePanel() {
  const [days, setDays] = useState<AiUsageDay[]>();
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setDays(undefined); setError("");
    void fetchAdminAiUsage(controller.signal)
      .then(value => { if (!controller.signal.aborted) setDays(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "사용량을 불러오지 못했습니다."); });
    return () => controller.abort();
  }, [version]);
  return <section aria-label="AI 상담 사용량">
    <h3>최근 7일 AI 상담 사용량</h3>
    <p>한국 시간 기준 · 거절된 한도 초과 요청은 제외합니다. 답변 내용은 저장하지 않습니다.</p>
    <button type="button" onClick={() => setVersion(value => value + 1)} disabled={!days && !error}>{error ? "다시 시도" : "새로고침"}</button>
    {error && <p role="alert">{error}</p>}
    {!days && !error && <p role="status">사용량을 불러오는 중…</p>}
    {days && <div className="admin-sync-list">{days.map(day => {
      const completed = day.succeeded + day.failed;
      return <article key={day.date}>
        <b>{day.date}</b>
        <p>요청 {day.requests}건 · 성공 {day.succeeded}건 · 실패 {day.failed}건 · 진행 {day.active}건</p>
        <small>완료 요청 실패율: {completed ? (day.failed / completed * 100).toFixed(1) + "%" : "—"}</small>
      </article>;
    })}</div>}
    <small>실패에는 안전성 검사 거절·제공자 오류·처리 기한 초과가 포함됩니다. 실제 과금액이나 토큰 사용량과는 다릅니다.</small>
  </section>;
}
