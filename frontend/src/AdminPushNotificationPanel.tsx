import { useEffect, useState } from "react";
import { AdminPushNotificationDashboard, fetchAdminPushNotificationDashboard } from "./api";

export default function AdminPushNotificationPanel() {
  const [dashboard, setDashboard] = useState<AdminPushNotificationDashboard>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true); setError("");
    fetchAdminPushNotificationDashboard().then(setDashboard)
      .catch((value: unknown) => setError(value instanceof Error ? value.message : "푸시 현황을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  if (loading && !dashboard) return <p className="admin-sync-loading">푸시 발송 현황을 불러오는 중…</p>;
  if (error) return <div className="admin-sync-error"><p>{error}</p><button type="button" onClick={load}>다시 시도</button></div>;
  if (!dashboard) return null;
  return <div className="admin-push-panel">
    <div className="admin-sync-summary">
      <div><span>등록 기기</span><strong>{dashboard.registeredDeviceCount}</strong></div>
      <div><span>발송 대기</span><strong>{dashboard.pendingCount}</strong></div>
      <div className={dashboard.permanentlyFailedCount > 0 ? "danger" : ""}><span>최종 실패</span><strong>{dashboard.permanentlyFailedCount}</strong></div>
      <div><span>24시간 발송</span><strong>{dashboard.sentLast24Hours}</strong></div>
    </div>
    <div className="admin-sync-headline"><b>최종 실패 최근 10건</b><button type="button" onClick={load} disabled={loading}>{loading ? "갱신 중…" : "새로고침"}</button></div>
    <div className="admin-sync-list">
      {dashboard.recentFailures.map((item) => <article key={item.notificationId}>
        <div className="admin-sync-row"><span className="sync-status failed">실패</span><b>{item.noticeTitle}</b><small>{item.attempts}회 시도</small></div>
        <code>{item.error || "알 수 없는 오류"}</code>
      </article>)}
      {dashboard.recentFailures.length === 0 && <p className="admin-sync-empty">최종 실패한 푸시가 없습니다.</p>}
    </div>
  </div>;
}
