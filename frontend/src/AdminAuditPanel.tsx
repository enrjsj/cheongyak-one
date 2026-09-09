import { useEffect, useState } from "react";
import { AdminAuditAction, AdminAuditLog, fetchAdminAuditLogs } from "./api";

const ACTION_LABELS: Record<AdminAuditAction, string> = {
  MEMBER_LOGIN_UNLOCKED: "로그인 잠금 초기화",
  MEMBER_SESSIONS_REVOKED: "전체 세션 강제 종료",
  MEMBER_SUSPENDED: "회원 이용정지",
  MEMBER_REACTIVATED: "회원 이용정지 해제",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminAuditPanel() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAdminAuditLogs()
      .then((response) => { if (!cancelled) setLogs(response); })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "감사 로그를 불러오지 못했습니다.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version]);

  return (
    <div className="admin-audit-panel">
      <div className="admin-member-headline"><b>최근 관리자 작업 {logs.length}건</b><button type="button" disabled={loading} onClick={() => setVersion((value) => value + 1)}>{loading ? "조회 중…" : "새로고침"}</button></div>
      {error && <p className="admin-member-message error" role="alert">{error}</p>}
      {loading && logs.length === 0 ? <p className="admin-sync-loading">감사 로그를 불러오는 중…</p> : (
        <div className="admin-audit-list">
          {logs.map((log) => (
            <article key={log.id}>
              <div><b>{ACTION_LABELS[log.action]}</b><time>{formatDate(log.createdAt)}</time></div>
              <p><span>처리자</span>{log.actorEmail}</p>
              <p><span>대상</span>{log.targetEmail}</p>
              {log.details && <p><span>사유</span>{log.details}</p>}
              <small>{log.affectedCount.toLocaleString("ko-KR")}건 처리</small>
            </article>
          ))}
          {!loading && logs.length === 0 && <p className="admin-sync-empty">아직 기록된 관리자 작업이 없습니다.</p>}
        </div>
      )}
    </div>
  );
}
