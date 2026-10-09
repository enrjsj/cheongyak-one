import type { SourceFreshness, SourceSystem } from "./api";
import "./sourceFreshness.css";

export const SOURCE_LABELS: Record<SourceSystem, string> = {
  REB_APT: "아파트", REB_OFFICETEL: "오피스텔", MYHOME_PUBLIC_RENTAL: "공공임대",
};
const formatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function SourceFreshnessPanel({ sources, onRetry, busy = false }: {
  sources?: SourceFreshness[]; onRetry?: (source: SourceSystem) => void; busy?: boolean;
}) {
  if (!sources?.length) return null;
  return <details className="source-freshness" open={onRetry ? true : undefined}>
    <summary>유형별 수집 현황</summary>
    <ul>{sources.map(source => <li key={source.sourceSystem}>
      <div><strong>{SOURCE_LABELS[source.sourceSystem]}</strong><span>{!source.configured ? "수집 미설정"
        : source.status === "FRESH" ? "최신" : source.status === "DELAYED" ? "갱신 지연" : "확인 전"}</span></div>
      <p>마지막 성공: {source.lastSuccessfulAt ? Number.isFinite(Date.parse(source.lastSuccessfulAt)) ? formatter.format(new Date(source.lastSuccessfulAt)) : "시각 미확인" : "확인된 기록 없음"}</p>
      {onRetry && <>
        <p>최근 실행: {source.lastAttemptStatus === "RUNNING" ? "진행 중" : source.lastAttemptStatus === "FAILED" ? "실패"
          : source.lastAttemptStatus === "PARTIALLY_SUCCEEDED" ? "부분 성공" : source.lastAttemptStatus === "SUCCEEDED" ? "성공" : source.lastAttemptStatus === "SKIPPED" ? "건너뜀" : "기록 없음"}</p>
        <p>조회 {source.fetchedCount} · 저장 {source.savedCount} · 저장 실패 {source.failedNoticeCount} · 주택형 실패 {source.failedUnitTypeCount} · 주택형 빈 응답 {source.emptyUnitTypeCount}</p>
        {source.unitTypesDisabled && <p>주택형 수집 미설정</p>}
        {source.retryRecommended && <p>재수집 권장</p>}
        <button type="button" disabled={busy || !source.configured || source.lastAttemptStatus === "RUNNING"}
          onClick={() => onRetry(source.sourceSystem)}>{SOURCE_LABELS[source.sourceSystem]}만 재수집</button>
      </>}
    </li>)}</ul>
    {onRetry && <p>빈 응답은 제공된 주택형 자료가 없는 경우이며 실패·삭제 건수와 다릅니다. 재수집은 선택한 소스의 공고와 주택형을 다시 조회합니다.</p>}
  </details>;
}
