import { useEffect, useRef, useState } from "react";
import { ApiError, fetchAiAvailability, requestAiConsultation } from "./api";
import type { AiConsultation, AiTopic } from "./api";
import "./aiConsultation.css";

export function AiConsultationPanel({ noticeId, signedIn }: { noticeId: number; signedIn: boolean }) {
  const [available, setAvailable] = useState<boolean>();
  const [topic, setTopic] = useState<AiTopic>("ELIGIBILITY");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiConsultation>();
  const [error, setError] = useState("");
  const [connectionVersion, setConnectionVersion] = useState(0);
  const [expired, setExpired] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const active = useRef<AbortController | null>(null);
  const copyVersion = useRef(0);
  useEffect(() => {
    ++copyVersion.current;
    const controller = new AbortController();
    setAvailable(undefined);
    setResult(undefined);
    setError("");
    setConsent(false);
    setBusy(false);
    setExpired(false);
    setCopyStatus("");
    if (signedIn) void fetchAiAvailability(controller.signal)
      .then((value) => { if (!controller.signal.aborted) setAvailable(value.available); })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        const sessionExpired = cause instanceof ApiError && cause.status === 401;
        setExpired(sessionExpired);
        setError(sessionExpired ? "로그인이 만료되었습니다. 다시 로그인해주세요." : "상담 연결 상태를 확인하지 못했습니다.");
      });
    return () => { ++copyVersion.current; controller.abort(); active.current?.abort(); active.current = null; };
  }, [noticeId, signedIn, connectionVersion]);

  async function consult() {
    if (!available || !consent || expired || active.current) return;
    ++copyVersion.current;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(""); setResult(undefined); setCopyStatus("");
    try {
      const answer = await requestAiConsultation(noticeId, topic, consent, controller.signal);
      if (!controller.signal.aborted) setResult(answer);
    } catch (cause) {
      if (!controller.signal.aborted) {
        const sessionExpired = cause instanceof ApiError && cause.status === 401;
        setExpired(sessionExpired);
        setError(sessionExpired ? "로그인이 만료되었습니다. 다시 로그인해주세요." : cause instanceof Error ? cause.message : "상담을 불러오지 못했습니다.");
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  const syncedDate = result?.noticeSyncedAt ? new Date(result.noticeSyncedAt) : undefined;
  const validDate = syncedDate && Number.isFinite(syncedDate.getTime());
  const dateLabel = validDate ? syncedDate.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + " (한국 시간)" : "확인 불가";
  const stale = validDate && Date.now() - syncedDate.getTime() > 48 * 60 * 60 * 1000;
  async function copyAnswer() {
    if (!result) return;
    const version = ++copyVersion.current;
    setCopyStatus("");
    try {
      await navigator.clipboard.writeText(result.answer + "\n\n" + result.disclaimer + "\n공고 수집 기준: " + dateLabel);
      if (copyVersion.current === version) setCopyStatus("답변을 복사했습니다.");
    } catch {
      if (copyVersion.current === version) setCopyStatus("복사하지 못했습니다. 답변 텍스트를 직접 선택해 복사해주세요.");
    }
  }
  function cancel() {
    active.current?.abort();
    active.current = null;
    setBusy(false);
    setError("화면에서 응답 대기를 취소했습니다. 이미 시작된 서버 요청은 완료될 수 있습니다.");
  }
  return <section className="ai-consultation" aria-labelledby="ai-consultation-title">
    <h3 id="ai-consultation-title">AI 청약 상담</h3>
    <p>공고를 바탕으로 자격·자금·가점의 확인 항목을 정리합니다. 자격 판정이나 당첨 예측은 제공하지 않습니다.</p>
    {!signedIn ? <p>로그인 후 이용할 수 있습니다.</p> : <>
      {available === undefined && !error && <p role="status">상담 연결 확인 중…</p>}
      {available === false && <p role="status">OpenAI 연결 준비 중입니다. 연결 후 상담을 이용할 수 있습니다.</p>}
      {available && <>
        <label>상담 주제
          <select value={topic} disabled={busy || expired} onChange={(event) => { ++copyVersion.current; setTopic(event.target.value as AiTopic); setResult(undefined); setError(""); setCopyStatus(""); }}>
            <option value="ELIGIBILITY">신청 자격 확인</option>
            <option value="CASH">필요 현금 확인</option>
            <option value="SCORE">청약 가점 확인</option>
          </select>
        </label>
        <label className="ai-consent"><input type="checkbox" checked={consent} disabled={busy}
          onChange={(event) => setConsent(event.target.checked)} />
          공개 공고 정보와 선택한 주제를 OpenAI에 전송하는 데 동의합니다. 회원 개인정보는 전송하지 않습니다.
        </label>
        <small>상담 내용은 이 서비스에 저장하지 않습니다. 요청 시각·처리 결과 등 사용량 기록은 30일 보관합니다. OpenAI의 데이터 처리 정책이 적용됩니다.</small>
        <div className="ai-actions"><button type="button" className="secondary-button"
          disabled={!consent || busy || expired} onClick={() => void consult()}>{busy ? "답변 생성 중…" : error && !expired ? "답변 다시 요청" : "확인 항목 정리하기"}</button>
          {busy && <button type="button" onClick={cancel}>응답 대기 취소</button>}</div>
      </>}
      {error && <p role="alert">{error}</p>}
      {available === undefined && error && !expired && <button type="button" onClick={() => setConnectionVersion(value => value + 1)}>연결 다시 확인</button>}
      {result && <div className="ai-answer" aria-live="polite">
        <p>{result.answer}</p>
        <small>{result.disclaimer}</small>
        <small>공고 수집 기준: {dateLabel}</small>
        <small>{stale || !validDate ? "공고 수집 시점이 오래되었거나 확인되지 않습니다. " : ""}신청 전 공식 공고의 정정 내용과 최신 일정을 확인하세요.</small>
        <button type="button" onClick={() => void copyAnswer()}>답변 복사</button>
        {copyStatus && <small role="status">{copyStatus}</small>}
      </div>}
    </>}
  </section>;
}

