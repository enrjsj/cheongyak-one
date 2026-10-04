import { useEffect, useRef, useState } from "react";
import { ApiError } from "./api";
import type { MemberSession, PolicyConsent } from "./api";
import { accountDate, checkedConsents, checkedSessions } from "./accountAccessTools";
import "./accountAccessPanel.css";

interface Props {
  memberId: number;
  disabled?: boolean;
  onLoadSessions: () => Promise<MemberSession[]>;
  onRevokeSession: (id: number) => Promise<void>;
  onRevokeOtherSessions: () => Promise<MemberSession[]>;
  onLoadPolicyConsents: () => Promise<PolicyConsent[]>;
}

export default function AccountAccessPanel({ memberId, disabled = false, onLoadSessions, onRevokeSession, onRevokeOtherSessions, onLoadPolicyConsents }: Props) {
  const [sessions, setSessions] = useState<MemberSession[]>([]);
  const [consents, setConsents] = useState<PolicyConsent[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [consentsLoading, setConsentsLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [expired, setExpired] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<number | "others">();
  const [loaded, setLoaded] = useState(false);
  const epoch = useRef(0);
  const blocked = useRef(false);
  const mutating = useRef(false);
  const readingSessions = useRef(false);
  const readingConsents = useRef(false);
  const needsRefresh = useRef(true);

  const checkAccess = (error: unknown) => {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      blocked.current = true;
      setExpired(true);
      setConfirmation(undefined);
    }
  };

  async function loadSessions(scope: number) {
    if (scope !== epoch.current || blocked.current) return;
    readingSessions.current = true;
    setSessionsLoading(true); setSessionError(""); setConfirmation(undefined);
    try {
      const items = checkedSessions(await onLoadSessions());
      if (epoch.current !== scope) return;
      if (blocked.current) return;
      setSessions(items); setLoaded(true); needsRefresh.current = false;
    } catch (error) {
      if (epoch.current !== scope) return;
      needsRefresh.current = true;
      setSessionError(error instanceof Error ? error.message : "로그인 기기를 불러오지 못했습니다.");
      checkAccess(error);
    } finally {
      if (epoch.current === scope) { readingSessions.current = false; setSessionsLoading(false); }
    }
  }

  async function loadConsents(scope: number) {
    if (scope !== epoch.current || blocked.current) return;
    readingConsents.current = true;
    setConsentsLoading(true); setConsentError("");
    try {
      const items = checkedConsents(await onLoadPolicyConsents());
      if (epoch.current === scope && !blocked.current) setConsents(items);
    } catch (error) {
      if (epoch.current !== scope) return;
      setConsentError(error instanceof Error ? error.message : "동의 내역을 불러오지 못했습니다.");
      checkAccess(error);
    } finally {
      if (epoch.current === scope) { readingConsents.current = false; setConsentsLoading(false); }
    }
  }

  useEffect(() => {
    const scope = ++epoch.current;
    blocked.current = false; mutating.current = false; needsRefresh.current = true;
    setExpired(false); setWorking(false); setLoaded(false); setSessions([]); setConsents([]);
    setMessage(""); setConfirmation(undefined);
    void loadSessions(scope); void loadConsents(scope);
    return () => { ++epoch.current; };
  }, [memberId, onLoadSessions, onLoadPolicyConsents]);

  const reloadSessions = () => {
    if (blocked.current || disabled || mutating.current || readingSessions.current) return;
    void loadSessions(epoch.current);
  };
  const reloadConsents = () => {
    if (blocked.current || disabled || readingConsents.current) return;
    void loadConsents(epoch.current);
  };
  const locked = disabled || expired || working || sessionsLoading || !loaded || Boolean(sessionError);

  async function revoke() {
    const target = confirmation;
    if (target === undefined || disabled || blocked.current || mutating.current || readingSessions.current || needsRefresh.current) return;
    if (target !== "others" && !sessions.some(session => session.id === target && !session.current)) return;
    if (target === "others" && !sessions.some(session => !session.current)) return;
    const scope = epoch.current;
    mutating.current = true;
    setWorking(true); setSessionError(""); setMessage(""); setConfirmation(undefined);
    try {
      if (target === "others") await onRevokeOtherSessions();
      else await onRevokeSession(target);
      if (scope !== epoch.current || blocked.current) return;
      setMessage("기기 종료 요청을 처리했습니다. 최신 목록을 다시 확인합니다.");
      await loadSessions(scope);
    } catch (error) {
      if (scope !== epoch.current) return;
      needsRefresh.current = true;
      setSessionError(error instanceof Error ? error.message : "종료 결과를 확인하지 못했습니다.");
      checkAccess(error);
    } finally {
      if (scope === epoch.current) { mutating.current = false; setWorking(false); }
    }
  }

  return <div className="account-access-panel">
    {expired && <p role="alert" className="member-message error">로그인이 만료되었거나 권한이 없습니다. 다시 로그인한 뒤 계정 창을 열어주세요.</p>}
    <section className="account-section consent-section" aria-busy={consentsLoading}>
      <div className="session-heading"><h3>약관 동의 내역</h3><button type="button" disabled={disabled || expired || consentsLoading} onClick={reloadConsents}>동의 내역 새로고침</button></div>
      {consentsLoading ? <p role="status">동의 내역을 불러오는 중…</p> : consentError ? <p role="alert" className="member-message error">{consentError}</p> : consents.length ? <ul className="policy-consent-history">{consents.map((consent, index) => <li key={index}><b>{consent.policyType === "TERMS" ? "서비스 이용약관" : "개인정보 처리방침"}</b><span>{consent.policyVersion} · {accountDate(consent.agreedAt, false)}</span></li>)}</ul> : !expired && <p>기록된 동의 내역이 없습니다.</p>}
    </section>
    <section className="account-section session-section" aria-busy={sessionsLoading || working}>
      <div className="session-heading"><div><h3>로그인 기기</h3><p>현재 기기는 유지하고 다른 기기의 로그인을 종료할 수 있습니다.</p></div><button type="button" disabled={disabled || expired || working || sessionsLoading} onClick={reloadSessions}>기기 목록 새로고침</button></div>
      {loaded && <p>조회된 기기 {sessions.length}개 · 다른 기기 {sessions.filter(session => !session.current).length}개{sessionError ? " (이전 조회 결과)" : ""}</p>}
      {working && <p role="status">기기 종료 처리 중… 창을 닫아도 서버에서 요청이 처리될 수 있습니다.</p>}
      {message && <p role="status">{message}</p>}
      {sessionError && <div role="alert" className="member-message error"><p>{sessionError}</p><p>추가 종료 전 기기 목록을 새로고침해 현재 상태를 확인해주세요.</p></div>}
      {sessionsLoading ? <p role="status">로그인 기기를 확인하고 있습니다…</p> : sessions.map(session => <article className={`session-item${session.current ? " current" : ""}`} key={session.id}>
        <span className="session-device" aria-hidden="true">{session.current ? "●" : "○"}</span>
        <div><b>{session.clientName}{session.current && <em>현재 기기</em>}</b><small>{accountDate(session.createdAt)} 로그인</small><small>{accountDate(session.expiresAt)} 자동 만료</small></div>
        {!session.current && <button type="button" disabled={locked} onClick={() => setConfirmation(session.id)}>종료</button>}
      </article>)}
      {loaded && !sessionsLoading && !sessionError && !sessions.length && <p>표시할 로그인 기기가 없습니다.</p>}
      {sessions.some(session => !session.current) && <button type="button" disabled={locked} onClick={() => setConfirmation("others")}>다른 기기 모두 종료</button>}
      {confirmation !== undefined && <div className="session-confirm" role="group" aria-label="기기 종료 확인"><p>{confirmation === "others" ? "현재 기기를 제외한 모든 기기를 종료할까요?" : `${sessions.find(session => session.id === confirmation)?.clientName ?? "선택한 기기"}의 로그인을 종료할까요?`}</p><button type="button" disabled={locked} onClick={() => void revoke()}>종료 확인</button><button type="button" disabled={working} onClick={() => setConfirmation(undefined)}>취소</button></div>}
    </section>
  </div>;
}
