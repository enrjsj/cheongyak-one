import { useEffect, useState } from "react";
import { AdminSyncDashboard, fetchAdminSyncDashboard, SyncExecutionStatus } from "./api";
import AdminMembersPanel from "./AdminMembersPanel";
import AdminAuditPanel from "./AdminAuditPanel";
import { useDialogAccessibility } from "./useDialogAccessibility";

interface AdminSyncDialogProps {
  open: boolean;
  onClose: () => void;
  currentMemberId: number;
}

const STATUS_LABELS: Record<SyncExecutionStatus, string> = {
  RUNNING: "실행 중",
  SUCCEEDED: "성공",
  FAILED: "실패",
};

function formatDate(value?: string | null): string {
  if (!value) return "–";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return "진행 중";
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

export default function AdminSyncDialog({ open, onClose, currentMemberId }: AdminSyncDialogProps) {
  const [tab, setTab] = useState<"sync" | "members" | "audit">("sync");
  const [dashboard, setDashboard] = useState<AdminSyncDashboard>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);

  useEffect(() => {
    if (!open || tab !== "sync") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchAdminSyncDashboard()
      .then((result) => {
        if (!cancelled) setDashboard(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "운영 현황을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, version, tab]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} tabIndex={-1} className="modal admin-sync-modal" role="dialog" aria-modal="true" aria-labelledby="admin-sync-title">
        <div className="modal-head">
          <div><span>ADMIN OPERATIONS</span><h2 id="admin-sync-title">운영 관리</h2></div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="admin-operation-tabs" role="tablist" aria-label="운영 관리 메뉴">
          <button type="button" role="tab" aria-selected={tab === "sync"} className={tab === "sync" ? "active" : ""} onClick={() => setTab("sync")}>공고 동기화</button>
          <button type="button" role="tab" aria-selected={tab === "members"} className={tab === "members" ? "active" : ""} onClick={() => setTab("members")}>회원 관리</button>
          <button type="button" role="tab" aria-selected={tab === "audit"} className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>감사 로그</button>
        </div>

        {tab === "members" ? <AdminMembersPanel currentMemberId={currentMemberId} /> : tab === "audit" ? <AdminAuditPanel /> : loading && !dashboard ? <p className="admin-sync-loading" role="status">운영 현황을 불러오는 중…</p> : error ? (
          <div className="admin-sync-error" role="alert"><p>{error}</p><button type="button" onClick={() => setVersion((value) => value + 1)}>다시 시도</button></div>
        ) : dashboard && (
          <>
            <div className="admin-sync-summary">
              <div><span>실행 중</span><strong>{dashboard.runningCount}</strong></div>
              <div className={dashboard.failuresLast24Hours > 0 ? "danger" : ""}><span>24시간 실패</span><strong>{dashboard.failuresLast24Hours}</strong></div>
              <div><span>최근 성공</span><strong>{formatDate(dashboard.lastSuccessfulAt)}</strong></div>
            </div>
            <div className="admin-sync-headline"><b>최근 실행 50건</b><button type="button" onClick={() => setVersion((value) => value + 1)} disabled={loading}>{loading ? "갱신 중…" : "새로고침"}</button></div>
            <div className="admin-sync-list">
              {dashboard.executions.map((execution) => (
                <article key={execution.id}>
                  <div className="admin-sync-row">
                    <span className={`sync-status ${execution.status.toLowerCase()}`}>{STATUS_LABELS[execution.status]}</span>
                    <b>{formatDate(execution.startedAt)}</b>
                    <small>{formatDuration(execution.durationSeconds)}</small>
                  </div>
                  <p>조회 {execution.fetchedCount.toLocaleString("ko-KR")}건 · 저장 {execution.savedCount.toLocaleString("ko-KR")}건</p>
                  {execution.errorMessage && <code>{execution.errorMessage}</code>}
                </article>
              ))}
              {dashboard.executions.length === 0 && <p className="admin-sync-empty">아직 동기화 실행 이력이 없습니다.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
