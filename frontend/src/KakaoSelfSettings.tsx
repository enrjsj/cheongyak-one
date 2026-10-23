import { useEffect, useRef, useState } from "react";
import { ApiError, authorizeKakaoSelf, disconnectKakaoSelf, fetchKakaoSelfStatus, testKakaoSelf } from "./api";
import type { KakaoSelfStatus, NotificationPreference } from "./api";
import "./kakaoSelfSettings.css";

const SUPPORTED_SCHEDULES = [
  { key: "applyStartEnabled", label: "접수 시작일" },
  { key: "deadline7dEnabled", label: "마감 7일 전" },
  { key: "deadline3dEnabled", label: "마감 3일 전" },
  { key: "deadline1dEnabled", label: "마감 1일 전" },
] as const;

export default function KakaoSelfSettings({ locked, dirty, returnResult, savedPreference, onEditSchedule }: {
  locked: boolean; dirty: boolean; returnResult?: string;
  savedPreference?: NotificationPreference;
  onEditSchedule: () => void;
}) {
  const [status, setStatus] = useState<KakaoSelfStatus>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [version, setVersion] = useState(0);
  const scope = useRef(0);
  const mutation = useRef(false);
  const currentGuard = useRef({ locked, dirty });
  currentGuard.current = { locked, dirty };

  useEffect(() => {
    const epoch = ++scope.current;
    const controller = new AbortController();
    setLoading(true); setError(""); setBlocked(false);
    fetchKakaoSelfStatus(controller.signal).then(value => {
      if (epoch === scope.current) setStatus(value);
    }).catch((value: unknown) => {
      if (epoch !== scope.current) return;
      // Older backends do not expose this optional channel yet.
      if (value instanceof ApiError && value.status === 404) setStatus(undefined);
      else {
        setStatus(undefined);
        setError("카카오 연결 상태를 확인하지 못했어요.");
        setBlocked(value instanceof ApiError && [401, 403].includes(value.status));
      }
    }).finally(() => { if (epoch === scope.current) setLoading(false); });
    return () => { ++scope.current; controller.abort(); };
  }, [version]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(false), 60_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const act = async (action: "connect" | "disconnect" | "test") => {
    if (mutation.current || locked || dirty || blocked || loading || !status?.eligible) return;
    mutation.current = true;
    const epoch = scope.current;
    setBusy(true); setError(""); setNotice("");
    try {
      if (action === "connect") {
        const result = await authorizeKakaoSelf();
        if (epoch !== scope.current) return;
        if (currentGuard.current.locked || currentGuard.current.dirty) {
          throw new Error("알림 설정이 변경되었어요. 저장을 마친 뒤 카카오 연결을 다시 눌러주세요.");
        }
        const url = new URL(result.authorizationUrl);
        if (url.origin !== "https://kauth.kakao.com" || url.pathname !== "/oauth/authorize" || url.username || url.password) {
          throw new Error("카카오 연결 주소를 확인하지 못했어요.");
        }
        window.location.assign(url.href);
      } else if (action === "disconnect") {
        await disconnectKakaoSelf();
        if (epoch !== scope.current) return;
        setStatus({ ...status, connected: false, reconnectRequired: false });
        setNotice("이 서비스의 카카오 발송 연결을 해제했어요. 카카오 앱 동의 철회는 카카오 계정에서 할 수 있어요.");
        setVersion(value => value + 1);
      } else {
        setCooldown(true);
        const result = await testKakaoSelf();
        if (epoch !== scope.current) return;
        setStatus(result);
        setNotice(result.lastDeliveryStatus === "SENT"
          ? "카카오가 시험 메시지 발송을 접수했어요. 나와의 채팅방에서 확인해주세요."
          : result.message);
      }
    } catch (value) {
      if (epoch !== scope.current) return;
      setError(value instanceof Error ? value.message : "요청을 처리하지 못했어요.");
      if (value instanceof ApiError && [401, 403].includes(value.status)) setBlocked(true);
      if (action === "test") {
        // A failed/timeout response may already have sent a message. Never retry automatically.
        setNotice("발송 결과가 불확실할 수 있어요. 나와의 채팅방을 확인한 뒤 연결 상태를 새로고침해주세요.");
        setStatus(undefined);
      }
    } finally {
      mutation.current = false;
      if (epoch === scope.current) setBusy(false);
    }
  };

  if (!loading && !error && !status?.eligible) return null;
  const disabled = locked || dirty || busy || blocked || loading;
  const enabledSchedules = savedPreference && SUPPORTED_SCHEDULES.filter(option => savedPreference[option.key]);
  return <section className="kakao-self-settings" aria-label="카카오톡 나에게 보내기" aria-busy={loading || busy}>
    <strong>카카오톡 나에게 보내기</strong>
    <p>연결한 본인의 ‘나와의 채팅방’으로 관심 공고의 접수 시작·마감 7일·3일·1일 전 알림을 보내요.</p>
    {loading ? <p role="status">연결 상태 확인 중…</p> : status && <>
      <span className="kakao-self-state">{status.reconnectRequired ? "다시 연결 필요" : status.connected ? "연결됨" : status.configured ? "연결 전" : "서버 설정 필요"}</span>
      <p>{status.message}</p>
      <div className="kakao-self-schedules" role="group" aria-label="카카오 수신 일정">
        <b>저장된 수신 일정</b>
        {!enabledSchedules ? <p>알림 설정을 확인한 뒤 수신 일정을 표시해요.</p>
          : enabledSchedules.length === 0 ? <p role="status">수신 일정이 모두 꺼져 있어요. 카카오를 연결해도 자동 일정 알림은 보내지 않아요.</p>
          : <ul>{enabledSchedules.map(option => <li key={option.key}>{option.label}</li>)}</ul>}
        {dirty && <p>표시된 목록은 마지막으로 저장한 설정이에요. 변경한 일정은 저장 후 반영돼요.</p>}
        <small>당첨자 발표·저장 조건 신규 공고·공고 정보 변경은 카카오 나에게 보내기에서 아직 지원하지 않아요. 이메일·앱 푸시 선택과는 별개예요.</small>
        <button type="button" disabled={locked || busy || blocked || loading} onClick={onEditSchedule}>수신할 일정 설정</button>
      </div>
      {returnResult === "connected" && status.connected && !status.reconnectRequired && <p role="status">카카오 계정 연결을 확인했어요.</p>}
      {returnResult === "cancelled" && <p role="status">카카오 연결을 취소했어요.</p>}
      {returnResult === "error" && <p role="status">연결을 완료하지 못했어요. 현재 연결 상태를 확인한 뒤 다시 시도해주세요.</p>}
      {status.lastSentAt && <small>최근 발송 접수: {new Date(status.lastSentAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간)</small>}
      <div className="kakao-self-actions">
        {(!status.connected || status.reconnectRequired) && <button type="button" disabled={disabled || !status.configured} onClick={() => void act("connect")}>{status.reconnectRequired ? "카카오 다시 연결" : "카카오 계정 연결"}</button>}
        {status.connected && !status.reconnectRequired && <button type="button" disabled={disabled || !status.configured || cooldown} onClick={() => void act("test")}>{cooldown ? "시험 발송 후 1분 대기" : "나에게 시험 메시지 보내기"}</button>}
        {(status.connected || status.reconnectRequired) && <button type="button" disabled={disabled} onClick={() => void act("disconnect")}>카카오 발송 연결 해제</button>}
      </div>
      <small>연결 이후 생성된 알림부터 보내며 지난 알림은 다시 보내지 않아요. 서버가 쉬는 동안 발송이 늦어질 수 있어요.</small>
      <details className="kakao-self-help">
        <summary>연결 방법 · 알림이 오지 않을 때</summary>
        <ol>
          <li>청약한눈에 로그인한 상태에서 ‘카카오 계정 연결’을 눌러 카카오 로그인과 메시지 전송 동의를 진행해주세요. 청약홈 로그인은 필요하지 않아요.</li>
          <li>공고의 북마크 버튼으로 관심 공고를 저장하고, 받을 일정을 선택해 ‘알림 설정 저장’을 눌러주세요.</li>
          <li>연결 후 ‘나에게 시험 메시지 보내기’로 카카오톡의 ‘나와의 채팅방’을 확인해주세요. 시험 메시지는 관심 공고·수신 일정 설정과 관계없이 보낼 수 있어요.</li>
        </ol>
        <p>관심 공고의 해당 일정에 새 알림이 생성되어야 자동 발송돼요. 연결 전에 만들어진 알림과 지난 날짜의 알림은 보내지 않아요. 연결 상태가 만료되었다면 다시 연결해주세요.</p>
        <p>공고별로 선택한 일정마다 한 건씩 보내요. 메시지에는 공고명·분양가 또는 보증금 등 공고 금액·공급면적과 환산 평수를 담고, 정보가 없으면 공고문 확인으로 표시해요.</p>
        <p>카카오 발송 기준은 관심 공고와 저장된 수신 일정이에요. 지역·예산·평수 검색조건이나 저장 조건 신규 공고 알림은 아직 카카오 발송에 적용되지 않아요.</p>
        <p>발송 접수는 카카오가 요청을 받았다는 뜻이에요. 휴대전화 수신·읽음까지 확인한 상태는 아니에요.</p>
      </details>
    </>}
    {dirty && <p role="status">변경한 알림 설정을 저장하거나 원래대로 돌린 뒤 카카오 연결을 변경해주세요.</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {blocked && <p>다시 로그인한 뒤 알림 설정을 열어주세요.</p>}
    <button type="button" disabled={locked || busy || loading || blocked} onClick={() => setVersion(value => value + 1)}>카카오 연결 상태 새로고침</button>
  </section>;
}
