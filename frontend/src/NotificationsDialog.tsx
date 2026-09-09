import { FormEvent, useEffect, useState } from "react";
import { useDialogAccessibility } from "./useDialogAccessibility";
import {
  fetchNotificationInbox,
  fetchNotificationPreference,
  markAllNotificationsRead,
  markNotificationRead,
  MemberNotification,
  NotificationInbox,
  NotificationPreference,
  saveNotificationPreference,
} from "./api";

interface NotificationsDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenNotice: (noticeId: number) => void;
  onUnreadCountChange: (count: number) => void;
}

const DEFAULT_PREFERENCE: NotificationPreference = {
  applyStartEnabled: true,
  deadline7dEnabled: true,
  deadline3dEnabled: true,
  deadline1dEnabled: true,
  winnerEnabled: true,
  newMatchingNoticeEnabled: true,
  noticeUpdatedEnabled: true,
  emailEnabled: false,
};

const PREFERENCE_OPTIONS: Array<{ key: Exclude<keyof Omit<NotificationPreference, "updatedAt">, "emailEnabled">; label: string }> = [
  { key: "applyStartEnabled", label: "접수 시작일" },
  { key: "deadline7dEnabled", label: "마감 7일 전" },
  { key: "deadline3dEnabled", label: "마감 3일 전" },
  { key: "deadline1dEnabled", label: "마감 1일 전" },
  { key: "winnerEnabled", label: "당첨자 발표일" },
  { key: "newMatchingNoticeEnabled", label: "저장 조건 신규 공고" },
  { key: "noticeUpdatedEnabled", label: "관심 공고 정보 변경" },
];

function formatNotificationDate(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  return `${month}월 ${day}일`;
}

function notificationDateLabel(notification: MemberNotification): string {
  const date = formatNotificationDate(notification.eventDate);
  if (notification.type === "NEW_MATCHING_NOTICE") return `${date} 신규 등록`;
  if (notification.type === "NOTICE_UPDATED") return `${date} 변경 확인`;
  return `${date} 일정`;
}

export default function NotificationsDialog({
  open,
  onClose,
  onOpenNotice,
  onUnreadCountChange,
}: NotificationsDialogProps) {
  const [tab, setTab] = useState<"inbox" | "settings">("inbox");
  const [inbox, setInbox] = useState<NotificationInbox>({ notifications: [], unreadCount: 0 });
  const [preference, setPreference] = useState<NotificationPreference>(DEFAULT_PREFERENCE);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>();
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);

  const refreshInbox = async (showProgress = false) => {
    if (showProgress) setLoading(true);
    try {
      const result = await fetchNotificationInbox();
      setInbox(result);
      setLastUpdatedAt(new Date());
      onUnreadCountChange(result.unreadCount);
      setError("");
    } catch (requestError) {
      if (showProgress) setError(requestError instanceof Error ? requestError.message : "알림을 불러오지 못했습니다.");
    } finally {
      if (showProgress) setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setNotice("");
    Promise.allSettled([fetchNotificationInbox(), fetchNotificationPreference()])
      .then(([inboxResult, preferenceResult]) => {
        if (cancelled) return;
        if (inboxResult.status === "fulfilled") {
          setInbox(inboxResult.value);
          setLastUpdatedAt(new Date());
          onUnreadCountChange(inboxResult.value.unreadCount);
        } else {
          setError(inboxResult.reason instanceof Error ? inboxResult.reason.message : "알림을 불러오지 못했습니다.");
        }
        if (preferenceResult.status === "fulfilled") {
          // 순차 배포 중 이전 백엔드 응답에 신규 설정값이 없어도 체크박스를 안정적으로 유지한다.
          setPreference({ ...DEFAULT_PREFERENCE, ...preferenceResult.value });
        } else if (inboxResult.status === "fulfilled") {
          setError("알림은 불러왔지만 알림 설정을 확인하지 못했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, onUnreadCountChange]);

  useEffect(() => {
    if (!open || tab !== "inbox") return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshInbox();
    };
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [open, tab]);

  if (!open) return null;

  const openNotification = async (notification: MemberNotification) => {
    if (!notification.readAt) {
      setBusyId(notification.id);
      try {
        const updated = await markNotificationRead(notification.id);
        const nextUnreadCount = Math.max(0, inbox.unreadCount - 1);
        setInbox((current) => ({
          unreadCount: nextUnreadCount,
          notifications: current.notifications.map((item) => item.id === updated.id ? updated : item),
        }));
        onUnreadCountChange(nextUnreadCount);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "알림을 읽음 처리하지 못했습니다.");
        setBusyId(undefined);
        return;
      }
      setBusyId(undefined);
    }
    onOpenNotice(notification.noticeId);
  };

  const readAll = async () => {
    setSaving(true);
    setError("");
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setInbox((current) => ({
        unreadCount: 0,
        notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
      }));
      onUnreadCountChange(0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "알림을 읽음 처리하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const savePreference = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      setPreference(await saveNotificationPreference({
        applyStartEnabled: preference.applyStartEnabled,
        deadline7dEnabled: preference.deadline7dEnabled,
        deadline3dEnabled: preference.deadline3dEnabled,
        deadline1dEnabled: preference.deadline1dEnabled,
        winnerEnabled: preference.winnerEnabled,
        newMatchingNoticeEnabled: preference.newMatchingNoticeEnabled,
        noticeUpdatedEnabled: preference.noticeUpdatedEnabled,
        emailEnabled: preference.emailEnabled,
      }));
      setNotice("알림 설정을 저장했습니다.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "알림 설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop notification-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section ref={dialogRef} tabIndex={-1} className="modal notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <div className="modal-head">
          <div><span>MY NOTIFICATIONS</span><h2 id="notification-title">맞춤 청약 알림</h2></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="닫기">×</button>
        </div>
        <div className="notification-tabs" role="tablist" aria-label="알림 메뉴">
          <button type="button" role="tab" aria-selected={tab === "inbox"} className={tab === "inbox" ? "active" : ""} onClick={() => setTab("inbox")}>알림함 {inbox.unreadCount > 0 && <b>{inbox.unreadCount}</b>}</button>
          <button type="button" role="tab" aria-selected={tab === "settings"} className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>알림 설정</button>
        </div>

        {loading ? <p className="notification-state">알림을 불러오고 있습니다…</p> : tab === "inbox" ? (
          <div className="notification-inbox">
            <div className="notification-inbox-actions">
              <small aria-live="polite">{lastUpdatedAt ? `${lastUpdatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 확인` : "확인 전"}</small>
              <button type="button" onClick={() => void refreshInbox(true)} disabled={loading || saving}>새로고침</button>
              {inbox.unreadCount > 0 && <button className="read-all-button" type="button" onClick={() => void readAll()} disabled={saving}>모두 읽음</button>}
            </div>
            {inbox.notifications.map((item) => (
              <button className={`notification-item${item.readAt ? " read" : ""}`} type="button" key={item.id} disabled={busyId !== undefined} onClick={() => void openNotification(item)}>
                <span className="notification-dot" aria-hidden="true"></span>
                <span><b>{item.noticeTitle}</b><small>{item.message}</small><em>{notificationDateLabel(item)}</em></span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
            {inbox.notifications.length === 0 && <div className="notification-empty"><b>아직 도착한 알림이 없어요</b><p>관심청약 일정과 저장한 조건의 신규 공고를 알려드릴게요.</p></div>}
          </div>
        ) : (
          <form className="notification-settings" onSubmit={(event) => void savePreference(event)}>
            <p>관심청약 일정과 저장한 검색조건 알림을 선택하세요.</p>
            {PREFERENCE_OPTIONS.map((option) => (
              <label key={option.key}>
                <span>{option.label}</span>
                <input type="checkbox" checked={preference[option.key]} onChange={(event) => setPreference((current) => ({ ...current, [option.key]: event.target.checked }))} />
              </label>
            ))}
            <label className="email-notification-option">
              <span><b>이메일로도 받기</b><small>인증한 회원 이메일로 선택한 일정을 보내드려요.</small></span>
              <input type="checkbox" checked={preference.emailEnabled} onChange={(event) => setPreference((current) => ({ ...current, emailEnabled: event.target.checked }))} />
            </label>
            <button className="primary-button" type="submit" disabled={saving}>{saving ? "저장 중…" : "알림 설정 저장"}</button>
          </form>
        )}
        {notice && <p className="member-message success" role="status">{notice}</p>}
        {error && <p className="member-message error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
