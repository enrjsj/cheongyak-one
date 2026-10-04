import { useEffect, useRef, useState } from "react";
import { ApiError, AdminPushNotificationDashboard, dispatchAdminPushNotifications, fetchAdminPushNotificationDashboard, retryAdminPushNotification } from "./api";

export default function AdminPushNotificationPanel() {
  const [dashboard, setDashboard] = useState<AdminPushNotificationDashboard>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number>();
  const [message, setMessage] = useState("");
  const [dispatchWarning, setDispatchWarning] = useState("");
  const [expired, setExpired] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const lifetime = useRef(0);
  const busy = useRef(false);
  const reading = useRef(false);
  const blocked = useRef(false);
  const needsRefresh = useRef(false);

  function fail(value: unknown, fallback: string) {
    const unauthorized = value instanceof ApiError && (value.status === 401 || value.status === 403);
    blocked.current = unauthorized;
    setExpired(unauthorized);
    setError(unauthorized ? "로그인이 만료되었거나 관리자 권한이 없습니다. 다시 로그인해주세요." : value instanceof Error ? value.message : fallback);
  }

  async function refresh(epoch: number) {
    reading.current = true;
    setLoading(true); setError("");
    try {
      const value = await fetchAdminPushNotificationDashboard();
      if (lifetime.current !== epoch) return;
      setDashboard(value);
      needsRefresh.current = false; setRefreshRequired(false);
    } catch (value) {
      if (lifetime.current !== epoch) return;
      needsRefresh.current = true; setRefreshRequired(true);
      fail(value, "푸시 현황을 불러오지 못했습니다.");
    } finally {
      if (lifetime.current === epoch) { reading.current = false; setLoading(false); }
    }
  }

  function load() {
    if (busy.current || reading.current || blocked.current) return;
    void refresh(lifetime.current);
  }

  useEffect(() => {
    const epoch = ++lifetime.current;
    void refresh(epoch);
    return () => { ++lifetime.current; };
  }, []);

  async function act(notificationId: number) {
    if (busy.current || reading.current || blocked.current || needsRefresh.current) return;
    const epoch = lifetime.current;
    busy.current = true;
    setWorkingId(notificationId); setError(""); setMessage(""); setDispatchWarning("");
    try {
      if (notificationId === -1) {
        const result = await dispatchAdminPushNotifications();
        if (lifetime.current !== epoch) return;
        const detailed = result.selectedCount !== undefined && result.otherCount !== undefined && result.errorCount !== undefined && result.acceptedCount !== undefined;
        setMessage(detailed
          ? `이번 처리 대상 ${result.selectedCount}건 · 접수 확인 ${result.acceptedCount}건 · 접수 확인 외 ${result.otherCount}건 · 처리 오류 ${result.errorCount}건. 접수 확인 외에는 재시도 대기·기기 없음·건너뜀 등이 포함되며 실제 기기 수신을 보장하지 않습니다.`
          : result.acceptedCount === undefined
          ? `대기 푸시 처리 완료: ${result.sentCount}건. 구버전 서버의 처리 종료 집계입니다. 실제 기기 수신을 보장하지 않습니다.`
          : `공급사 접수 확인 후 종료: ${result.acceptedCount}건. 기기 없음·토큰 만료 종료는 제외하며 실제 기기 수신을 보장하지 않습니다.`);
        if (result.errorCount !== undefined && result.errorCount > 0) {
          setDispatchWarning(`${result.errorCount}건의 처리 결과를 확정하지 못했습니다. 다른 알림은 계속 처리했으며, 재실행 전 최신 현황과 서버 로그를 확인해주세요.`);
        }
      } else {
        await retryAdminPushNotification(notificationId);
        if (lifetime.current !== epoch) return;
        setMessage("재시도 대기열에 등록했습니다. 실제 발송 완료를 의미하지 않습니다.");
      }
      // Keep the action locked until its refreshed result has been applied.
      await refresh(epoch);
    } catch (value) {
      if (lifetime.current !== epoch) return;
      needsRefresh.current = true; setRefreshRequired(true);
      fail(value, "처리 결과를 확인하지 못했습니다. 현황을 새로고침해주세요.");
    } finally {
      if (lifetime.current === epoch) { busy.current = false; setWorkingId(undefined); }
    }
  }

  const disabled = expired || loading || workingId !== undefined || refreshRequired;
  return <div className="admin-push-panel">
    {loading && <p className="admin-sync-loading" role="status">푸시 발송 현황을 불러오는 중…</p>}
    {message && <p role="status">{message}</p>}
    {workingId === -1 && <p role="status">대기 푸시를 처리하고 있습니다. 결과 확인까지 잠시 기다려주세요.</p>}
    {dispatchWarning && <p className="admin-sync-error" role="alert">{dispatchWarning}</p>}
    {error && <div className="admin-sync-error" role="alert"><p>{error}</p>
      {!expired && <button type="button" onClick={load} disabled={loading || workingId !== undefined}>현황 다시 불러오기</button>}
    </div>}
    {dashboard && <>
    <div className="admin-sync-summary">
      <div><span>등록 기기</span><strong>{dashboard.registeredDeviceCount}</strong></div>
      <div><span>발송 대기</span><strong>{dashboard.pendingCount}</strong></div>
      <div className={dashboard.permanentlyFailedCount > 0 ? "danger" : ""}><span>최종 실패</span><strong>{dashboard.permanentlyFailedCount}</strong></div>
      <div><span>{dashboard.unknownLast24Hours === undefined ? "24시간 처리 종료 (구버전)" : "24시간 공급사 접수 확인"}</span><strong>{dashboard.sentLast24Hours}</strong></div>
    </div>
    {dashboard.unknownLast24Hours === undefined ? <p>서버 업데이트 후 발송 결과를 구분해 표시합니다.</p> : <div className="admin-sync-summary">
      <div><span>24시간 기기 없음 종료</span><strong>{dashboard.noDevicesLast24Hours}</strong></div>
      <div><span>24시간 토큰 만료 종료</span><strong>{dashboard.invalidTokensLast24Hours}</strong></div>
      <div><span>24시간 결과 확인 불가</span><strong>{dashboard.unknownLast24Hours}</strong></div>
    </div>}
    <p>알림 건수 기준입니다. 공급사 접수 확인은 하나 이상의 기기가 접수되고 처리가 종료된 경우이며, 실제 기기 수신을 보장하지 않습니다. 이전 기록은 확인 불가로 표시될 수 있습니다.</p>
    <div className="admin-sync-headline"><b>최종 실패 최근 10건</b><span><button type="button" onClick={() => void act(-1)} disabled={disabled}>대기 발송</button><button type="button" onClick={load} disabled={expired || loading || workingId !== undefined}>새로고침</button></span></div>
    <div className="admin-sync-list">
      {dashboard.recentFailures.map((item) => <article key={item.notificationId}>
        <div className="admin-sync-row"><span className="sync-status failed">실패</span><b>{item.noticeTitle}</b><small>{item.attempts}회 시도</small></div>
        <code>{item.error || "알 수 없는 오류"}</code><button type="button" onClick={() => void act(item.notificationId)} disabled={disabled}>{workingId === item.notificationId ? "처리 중…" : "재시도"}</button>
      </article>)}
      {dashboard.recentFailures.length === 0 && <p className="admin-sync-empty">최종 실패한 푸시가 없습니다.</p>}
    </div>
    </>}
  </div>;
}
