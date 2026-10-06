import { useEffect, useState } from "react";
import { fetchAdminAiUsage, fetchAdminAiMetrics } from "./api";
import type { AiUsageDay, AiUsageMetrics } from "./api";

export default function AdminAiUsagePanel() {
  const [days, setDays] = useState<AiUsageDay[]>();
  const [metrics, setMetrics] = useState<AiUsageMetrics>();
  const [metricsError, setMetricsError] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setDays(undefined); setError(""); setMetrics(undefined); setMetricsError("");
    void fetchAdminAiMetrics(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (!value || !Array.isArray(value.models) || !Array.isArray(value.failures) || !value.budget) throw new Error("상세 사용량을 확인하지 못했습니다.");
      setMetrics(value);
    }).catch(() => { if (!controller.signal.aborted) setMetricsError("비용·품질 지표를 확인하지 못했습니다. 새로고침으로 다시 확인해주세요."); });
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
    {metricsError && <p role="status">{metricsError}</p>}
    {metrics && <div className="ai-usage-metrics">
      <h4>오늘의 예상비용 한도</h4>
      <p>한국 시간 {metrics.budget.date} 요청 기준 · {metrics.budget.enforced ? `한도 ${usd(metrics.budget.limitUsd)}` : "예산 제한 미설정"}</p>
      <p>확인된 예상비용 + 미확정 예약액: {usd(metrics.budget.committedUsd)} · 이 중 미확정 예약액 {usd(metrics.budget.reservedUsd)}</p>
      {metrics.budget.unreservedRequests > 0 && <p>예약액도 미확인인 요청 {metrics.budget.unreservedRequests}건. 예산 제한이 켜져 있으면 추가 요청을 차단합니다.</p>}
      <h4>모델별 토큰·응답시간</h4>
      {metrics.models.length === 0 ? <p>최근 7일 상담 요청이 없습니다.</p> : metrics.models.map(model => <article key={model.model}>
        <b>{model.model === "UNKNOWN" ? "모델 미확인" : model.model}</b>
        <p>요청 {model.requests}건 · 사용량 확인 {model.usageKnownRequests}건 · 미확인 {model.requests - model.usageKnownRequests}건</p>
        <p>확인된 입력 {model.usageKnownRequests ? model.inputTokens.toLocaleString() : "—"} · 캐시 입력 {model.usageKnownRequests ? model.cachedInputTokens.toLocaleString() : "—"} · 출력 {model.usageKnownRequests ? model.outputTokens.toLocaleString() : "—"} 토큰</p>
        <p>예상비용 {usd(model.estimatedCostUsd)} ({model.pricedRequests}건 산정) · 평균 처리시간 {model.averageDurationMs == null ? "—" : (model.averageDurationMs / 1000).toFixed(2) + "초"}</p>
      </article>)}
      <h4>실패 유형</h4>
      {metrics.failures.length === 0 ? <p>기록된 실패가 없습니다.</p> : <ul>{metrics.failures.map(item => <li key={item.type}>{failureLabel(item.type)} {item.requests}건</li>)}</ul>}
      <small>비용은 요청 당시 설정한 USD 단가로 산정하며 실제 청구액이 아닙니다. 캐시 입력은 입력 토큰에 포함됩니다. 사용량 누락·전송 실패·처리 중단은 0원으로 확정하지 않고 예약액을 유지합니다. 평균 시간은 완료 기록이 있는 요청 기준입니다. 실패율과 근거 번호 검사는 답변의 사실 정확도를 보장하지 않습니다.</small>
    </div>}
    <small>실패에는 답변 검사 거절·제공자 오류·처리 기한 초과가 포함됩니다. 관리자 지표에는 상담 원문이나 회원 식별자를 표시하지 않습니다.</small>
  </section>;
}

function usd(value: number | null): string { return value == null ? "미확인" : `$${value.toFixed(8)} USD`; }
function failureLabel(type: string): string {
  return ({ PROVIDER_AUTH: "제공자 인증 오류", PROVIDER_RATE_LIMIT: "제공자 요청 제한", PROVIDER_ERROR: "제공자 오류", TIMEOUT: "응답 시간 초과", TRANSPORT: "연결 실패", INCOMPLETE: "미완료 응답", REFUSAL: "제공자 답변 거절", INVALID_RESPONSE: "응답 형식 오류", ANSWER_REJECTED: "답변·근거 검사 거절", INTERNAL: "내부 처리 오류", LEASE_EXPIRED: "처리 기한 만료", UNKNOWN: "이전 기록·유형 미확인" } as Record<string, string>)[type] ?? "기타 오류";
}
