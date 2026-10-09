// 읽음 처리와 공고 상세 이동을 제공하는 회원 알림함 모달이다.
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useDialogAccessibility } from "./useDialogAccessibility";
import {
  ApiError,
  fetchNotificationInbox,
  fetchNotificationPreference,
  markAllNotificationsRead,
  markNotificationRead,
  MemberNotification,
  NotificationInbox,
  NotificationPreference,
  saveNotificationPreference,
} from "./api";
import {
  filterNotifications,
  formatNotificationDate,
  notificationCategoryLabel,
  notificationFilterOptions,
  searchAndSortNotifications,
} from "./notificationTools";
import type { NotificationFilter, NotificationSort } from "./notificationTools";
import { fetchNotificationChannelAvailability } from "./notificationChannelsApi";
import type { NotificationChannelAvailability } from "./notificationChannelsApi";
import "./notificationInbox.css";
import "./notificationChannelStatus.css";

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
  appPushEnabled: true,
};

const DEFAULT_OUTBOUND_CHANNELS: NotificationChannelAvailability[] = [
  { id: "EMAIL", label: "이메일", available: false, message: "발송 서버 상태를 확인하지 못했어요." },
  { id: "APP_PUSH", label: "앱 푸시", available: false, message: "발송 서버와 기기 등록 상태를 확인하지 못했어요." },
  { id: "KAKAO_ALIMTALK", label: "카카오 알림톡", available: false, message: "사업자 채널·승인 템플릿을 연결한 뒤 사용할 수 있어요." },
  { id: "SMS", label: "문자", available: false, message: "발신번호와 문자 발송사를 연결한 뒤 사용할 수 있어요." },
];

const PREFERENCE_OPTIONS: Array<{ key: Exclude<keyof Omit<NotificationPreference, "updatedAt">, "emailEnabled">; label: string }> = [
  { key: "applyStartEnabled", label: "접수 시작일" },
  { key: "deadline7dEnabled", label: "마감 7일 전" },
  { key: "deadline3dEnabled", label: "마감 3일 전" },
  { key: "deadline1dEnabled", label: "마감 1일 전" },
  { key: "winnerEnabled", label: "당첨자 발표일" },
  { key: "newMatchingNoticeEnabled", label: "저장 조건 신규 공고" },
  { key: "noticeUpdatedEnabled", label: "관심 공고 정보 변경" },
];

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
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<NotificationSort>("NEWEST");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [readStatus, setReadStatus] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const [historyPending, setHistoryPending] = useState(false);
  const criteriaKey = JSON.stringify([query, filter, sort, readStatus, from, to]);
  const appliedCriteria = useRef(criteriaKey);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [refreshWarning, setRefreshWarning] = useState("");
  const [inbox, setInbox] = useState<NotificationInbox>({ notifications: [], unreadCount: 0 });
  const [preference, setPreference] = useState<NotificationPreference>(DEFAULT_PREFERENCE);
  const [channels, setChannels] = useState<NotificationChannelAvailability[]>(DEFAULT_OUTBOUND_CHANNELS);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  // A request can finish after Escape closes the dialog or another session opens it.
  const requestScope = useRef(0);
  const refreshSequence = useRef(0);
  const mutationBusy = useRef(false);
  const refreshBusy = useRef(false);
  const accessBlocked = useRef(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>();
  const dialogRef = useDialogAccessibility<HTMLElement>(open, onClose);

  const blockOnAuthError = (value: unknown) => {
    if (value instanceof ApiError && (value.status === 401 || value.status === 403)) {
      accessBlocked.current = true;
      setSessionExpired(true);
    }
  };

  const serverHistory = inbox.page !== undefined;
  const invalidPeriod = Boolean(from && to && from > to);
  const historyOptions = (page = 0, snapshotId?: number) => ({ query, filter, sort, readStatus, from, to, page, snapshotId });
  const loadHistory = async (page = 0, snapshotId?: number) => {
    if (accessBlocked.current || mutationBusy.current || invalidPeriod) { setHistoryPending(false); return; }
    const scope = requestScope.current;
    const sequence = ++refreshSequence.current;
    const current = () => scope === requestScope.current && sequence === refreshSequence.current;
    setHistoryPending(true);
    try {
      const result = await fetchNotificationInbox(historyOptions(page, snapshotId));
      if (!current()) return;
      setInbox(result);
      appliedCriteria.current = criteriaKey;
      setInboxLoaded(true);
      setRefreshWarning("");
      setError("");
      setLastUpdatedAt(new Date());
      onUnreadCountChange(result.unreadCount);
    } catch (requestError) {
      if (!current()) return;
      setRefreshWarning("알림을 조회하지 못했습니다. 표시된 목록은 이전 조회 결과입니다. 새로고침으로 다시 확인해주세요.");
      blockOnAuthError(requestError);
    } finally {
      if (current()) setHistoryPending(false);
    }
  };

  const refreshInbox = async (showProgress = false) => {
    if (accessBlocked.current || mutationBusy.current || refreshBusy.current || loading || historyPending) return;
    if (serverHistory) { await loadHistory(); return; }
    refreshBusy.current = true;
    const scope = requestScope.current;
    const sequence = ++refreshSequence.current;
    const current = () => scope === requestScope.current && sequence === refreshSequence.current;
    if (showProgress) setLoading(true);
    try {
      const result = await fetchNotificationInbox();
      if (!current()) return;
      setInbox(result);
      setInboxLoaded(true);
      setRefreshWarning("");
      setLastUpdatedAt(new Date());
      onUnreadCountChange(result.unreadCount);
      setError("");
    } catch (requestError) {
      if (!current()) return;
      setRefreshWarning("최근 알림을 갱신하지 못했습니다. 표시된 목록은 이전 조회 결과일 수 있어요. 새로고침으로 다시 확인해주세요.");
      if (showProgress) setError(requestError instanceof Error ? requestError.message : "알림을 불러오지 못했습니다.");
      blockOnAuthError(requestError);
    } finally {
      if (scope === requestScope.current) refreshBusy.current = false;
      if (current()) setLoading(false);
    }
  };

  useEffect(() => {
    ++requestScope.current;
    ++refreshSequence.current;
    if (!open) return;
    mutationBusy.current = false;
    refreshBusy.current = false;
    accessBlocked.current = false;
    let cancelled = false;
    setLoading(true);
    setSaving(false);
    setBusyId(undefined);
    setError("");
    setNotice("");
    setPreferenceLoaded(false);
    setPreferenceError("");
    setSessionExpired(false);
    setFilter("ALL");
    setFrom("");
    setTo("");
    setReadStatus("ALL");
    setHistoryPending(false);
    appliedCriteria.current = JSON.stringify(["", "ALL", "NEWEST", "ALL", "", ""]);
    setQuery("");
    setSort("NEWEST");
    setInbox({ notifications: [], unreadCount: 0 });
    setInboxLoaded(false);
    setLastUpdatedAt(undefined);
    setRefreshWarning("");
    setChannels(DEFAULT_OUTBOUND_CHANNELS);
    Promise.allSettled([fetchNotificationInbox(), fetchNotificationPreference(), fetchNotificationChannelAvailability()])
      .then(([inboxResult, preferenceResult, channelResult]) => {
        if (cancelled) return;
        const expired = [inboxResult, preferenceResult, channelResult].some(result =>
          result.status === "rejected" && result.reason instanceof ApiError && [401, 403].includes(result.reason.status));
        accessBlocked.current = expired;
        setSessionExpired(expired);
        if (inboxResult.status === "fulfilled") {
          setInbox(inboxResult.value);
          setInboxLoaded(true);
          setLastUpdatedAt(new Date());
          onUnreadCountChange(inboxResult.value.unreadCount);
        } else {
          setError(inboxResult.reason instanceof Error ? inboxResult.reason.message : "알림을 불러오지 못했습니다.");
        }
        if (preferenceResult.status === "fulfilled") {
          // 순차 배포 중 이전 백엔드 응답에 신규 설정값이 없어도 체크박스를 안정적으로 유지한다.
          setPreference({ ...DEFAULT_PREFERENCE, ...preferenceResult.value });
          setPreferenceLoaded(true);
        } else {
          setPreferenceError("기존 알림 설정을 확인하지 못했습니다. 설정을 다시 불러온 뒤 저장해주세요.");
        }
        if (channelResult.status === "fulfilled" && Array.isArray(channelResult.value.channels)) {
          setChannels(channelResult.value.channels);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; ++requestScope.current; ++refreshSequence.current; };
  }, [open, onUnreadCountChange, loadVersion]);

  useEffect(() => {
    if (!open || tab !== "inbox" || sessionExpired || loading || saving || busyId !== undefined || historyPending || (inbox.page ?? 0) > 0 || (serverHistory && appliedCriteria.current !== criteriaKey)) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshInbox();
    };
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [open, tab, sessionExpired, loading, saving, busyId, historyPending, criteriaKey, inbox.page, serverHistory]);

  useEffect(() => {
    if (!open || !serverHistory || sessionExpired) return;
    // Invalidate a previous search immediately, including during the debounce window.
    ++refreshSequence.current;
    if (appliedCriteria.current === criteriaKey) { setHistoryPending(false); return; }
    if (invalidPeriod) { setHistoryPending(false); return; }
    setHistoryPending(true);
    const timer = window.setTimeout(() => void loadHistory(), 300);
    return () => { window.clearTimeout(timer); ++refreshSequence.current; };
  }, [open, serverHistory, sessionExpired, criteriaKey]);

  const filteredNotifications = useMemo(() => serverHistory ? inbox.notifications : searchAndSortNotifications(filterNotifications(inbox.notifications, filter), query, sort), [serverHistory, filter, inbox.notifications, query, sort]);
  const filterOptions = useMemo(() => serverHistory ? [
    { value: "ALL" as const, label: "전체" }, { value: "UNREAD" as const, label: "읽지 않음" },
    { value: "SCHEDULE" as const, label: "일정" }, { value: "NEW" as const, label: "신규" }, { value: "UPDATED" as const, label: "변경" },
  ] : notificationFilterOptions(inbox.notifications), [serverHistory, inbox.notifications]);

  if (!open) return null;

  const openNotification = async (notification: MemberNotification) => {
    if (accessBlocked.current || mutationBusy.current || loading || historyPending || !inboxLoaded) return;
    mutationBusy.current = true;
    const scope = requestScope.current;
    ++refreshSequence.current;
    if (!notification.readAt) {
      setBusyId(notification.id);
      try {
        const updated = await markNotificationRead(notification.id);
        if (scope !== requestScope.current) return;
        const nextUnreadCount = Math.max(0, inbox.unreadCount - 1);
        setInbox((current) => ({
          ...current,
          unreadCount: nextUnreadCount,
          notifications: current.notifications.map((item) => item.id === updated.id ? updated : item),
        }));
        onUnreadCountChange(nextUnreadCount);
      } catch (requestError) {
        if (scope !== requestScope.current) return;
        setError(requestError instanceof Error ? requestError.message : "알림을 읽음 처리하지 못했습니다.");
        blockOnAuthError(requestError);
        mutationBusy.current = false;
        setBusyId(undefined);
        return;
      }
      setBusyId(undefined);
    }
    if (scope === requestScope.current) {
      mutationBusy.current = false;
      onOpenNotice(notification.noticeId);
    }
  };

  const readAll = async () => {
    if (accessBlocked.current || mutationBusy.current || loading || historyPending || !inboxLoaded) return;
    mutationBusy.current = true;
    const scope = requestScope.current;
    ++refreshSequence.current;
    setSaving(true);
    setError("");
    try {
      await markAllNotificationsRead();
      if (scope !== requestScope.current) return;
      const readAt = new Date().toISOString();
      setInbox((current) => ({
        ...current,
        unreadCount: 0,
        notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
      }));
      onUnreadCountChange(0);
      if (serverHistory) {
        // Reading changes unread-first order and membership; start a fresh page snapshot.
        try {
          const result = await fetchNotificationInbox(historyOptions());
          if (scope !== requestScope.current) return;
          setInbox(result);
          appliedCriteria.current = criteriaKey;
          onUnreadCountChange(result.unreadCount);
        } catch (requestError) {
          if (scope !== requestScope.current) return;
          setInbox(current => ({ ...current, page: 0, totalPages: 1, notifications: [], totalElements: 0 }));
          setInboxLoaded(false);
          setRefreshWarning("읽음 처리는 완료됐지만 목록을 갱신하지 못했습니다. 새로고침으로 다시 확인해주세요.");
          blockOnAuthError(requestError);
        }
      }
    } catch (requestError) {
      if (scope !== requestScope.current) return;
      setError(requestError instanceof Error ? requestError.message : "알림을 읽음 처리하지 못했습니다.");
      blockOnAuthError(requestError);
    } finally {
      if (scope === requestScope.current) { mutationBusy.current = false; setSaving(false); }
    }
  };

  const savePreference = async (event: FormEvent) => {
    event.preventDefault();
    if (!preferenceLoaded || accessBlocked.current || mutationBusy.current || loading) return;
    mutationBusy.current = true;
    const scope = requestScope.current;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await saveNotificationPreference({
        applyStartEnabled: preference.applyStartEnabled,
        deadline7dEnabled: preference.deadline7dEnabled,
        deadline3dEnabled: preference.deadline3dEnabled,
        deadline1dEnabled: preference.deadline1dEnabled,
        winnerEnabled: preference.winnerEnabled,
        newMatchingNoticeEnabled: preference.newMatchingNoticeEnabled,
        noticeUpdatedEnabled: preference.noticeUpdatedEnabled,
        emailEnabled: preference.emailEnabled,
        appPushEnabled: preference.appPushEnabled,
      });
      if (scope !== requestScope.current) return;
      setPreference(updated);
      setNotice("알림 설정을 저장했습니다.");
    } catch (requestError) {
      if (scope !== requestScope.current) return;
      setError(requestError instanceof Error ? requestError.message : "알림 설정을 저장하지 못했습니다.");
      blockOnAuthError(requestError);
    } finally {
      if (scope === requestScope.current) { mutationBusy.current = false; setSaving(false); }
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
              <button type="button" onClick={() => void refreshInbox(true)} disabled={loading || historyPending || invalidPeriod || saving || busyId !== undefined || sessionExpired}>새로고침</button>
              {inbox.unreadCount > 0 && <button className="read-all-button" type="button" onClick={() => void readAll()} disabled={saving || historyPending || busyId !== undefined || sessionExpired}>모두 읽음</button>}
            </div>
            {refreshWarning && <p className="member-message error" role="status">{refreshWarning}</p>}
            {inboxLoaded && <div className="notification-search">
              <label>알림 검색<input disabled={saving || sessionExpired} type="search" value={query} maxLength={100} placeholder="공고명 또는 알림 내용" onChange={event => setQuery(event.target.value)} /></label>
              <label>알림 정렬<select disabled={saving || sessionExpired} value={sort} onChange={event => setSort(event.target.value as NotificationSort)}><option value="NEWEST">최신순</option><option value="UNREAD_FIRST">읽지 않음 우선</option></select></label>
              {serverHistory && <>
                <label>읽음 상태<select aria-label="읽음 상태" disabled={saving || sessionExpired} value={readStatus} onChange={event => setReadStatus(event.target.value as typeof readStatus)}><option value="ALL">모든 상태</option><option value="UNREAD">읽지 않음</option><option value="READ">읽음</option></select></label>
                <label>받은 날짜부터<input disabled={saving || sessionExpired} type="date" min="1900-01-01" max="9999-12-31" value={from} onChange={event => setFrom(event.target.value)} /></label>
                <label>받은 날짜까지<input disabled={saving || sessionExpired} type="date" min="1900-01-01" max="9999-12-31" value={to} onChange={event => setTo(event.target.value)} /></label>
                <small>받은 날짜는 한국 시간 기준입니다. 모두 읽음은 전체 이력에 적용됩니다.</small>
              </>}
              {invalidPeriod && <p role="alert">시작일은 종료일보다 늦을 수 없습니다.</p>}
              <small role="status">{historyPending ? "전체 알림 이력을 조회하고 있습니다…" : serverHistory ? `검색 결과 ${inbox.totalElements ?? 0}건 · ${inbox.notifications.length}건 표시` : `불러온 ${inbox.notifications.length}건 중 ${filteredNotifications.length}건 표시`}</small>
              {query && <button type="button" disabled={saving || sessionExpired} onClick={() => setQuery("")}>검색 초기화</button>}
            </div>}
            {(serverHistory || inbox.notifications.length > 0) && <div className="notification-filter" role="group" aria-label="알림 분류">
              {filterOptions.map((option) => <button key={option.value} type="button" disabled={saving || sessionExpired} aria-pressed={filter === option.value} className={filter === option.value ? "active" : ""} onClick={() => setFilter(option.value)}>{option.label}</button>)}
            </div>}
            {filteredNotifications.map((item) => (
              <button className={`notification-item${item.readAt ? " read" : ""}`} type="button" key={item.id} disabled={saving || historyPending || busyId !== undefined || sessionExpired} onClick={() => void openNotification(item)}>
                <span className="notification-dot" aria-hidden="true"></span>
                <span><b>{item.noticeTitle}</b><small>{item.message}</small><em><strong>{notificationCategoryLabel(item.type)}</strong>{notificationDateLabel(item)}</em></span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
            {serverHistory && (inbox.totalPages ?? 0) > 1 && <nav className="notification-pagination" aria-label="알림 페이지">
              <button type="button" disabled={historyPending || saving || sessionExpired || invalidPeriod || appliedCriteria.current !== criteriaKey || inbox.page === 0} onClick={() => void loadHistory((inbox.page ?? 0) - 1, inbox.snapshotId)}>이전 페이지</button>
              <span>{(inbox.page ?? 0) + 1} / {inbox.totalPages} 페이지</span>
              <button type="button" disabled={historyPending || saving || sessionExpired || invalidPeriod || appliedCriteria.current !== criteriaKey || (inbox.page ?? 0) + 1 >= (inbox.totalPages ?? 0)} onClick={() => void loadHistory((inbox.page ?? 0) + 1, inbox.snapshotId)}>다음 페이지</button>
            </nav>}
            {!inboxLoaded ? <p className="notification-state">알림 목록을 확인하지 못했습니다. 새로고침으로 다시 불러와주세요.</p> : inbox.notifications.length === 0 && !query.trim() && filter === "ALL" && readStatus === "ALL" && !from && !to ? <div className="notification-empty"><b>아직 도착한 알림이 없어요</b><p>관심청약 일정과 저장한 조건의 신규 공고를 알려드릴게요.</p></div> : filteredNotifications.length === 0 && <div className="notification-empty"><b>{query.trim() ? "검색 결과가 없어요" : filter === "UNREAD" ? "읽지 않은 알림이 없어요" : "해당 분류의 알림이 없어요"}</b><p>검색어나 분류, 기간을 바꿔 다시 확인해주세요.</p></div>}
          </div>
        ) : (
          <form className="notification-settings" onSubmit={(event) => void savePreference(event)}>
            <p>관심청약 일정과 저장한 검색조건 알림을 선택하세요.</p>
            {preferenceError && <div role="alert"><p>{preferenceError}</p>
              {!sessionExpired && <button type="button" onClick={() => setLoadVersion(value => value + 1)}>설정 다시 불러오기</button>}
            </div>}
            {PREFERENCE_OPTIONS.map((option) => (
              <label key={option.key}>
                <span>{option.label}</span>
                <input type="checkbox" disabled={!preferenceLoaded || saving || sessionExpired} checked={preference[option.key]} onChange={(event) => setPreference((current) => ({ ...current, [option.key]: event.target.checked }))} />
              </label>
            ))}
            <label className="email-notification-option">
              <span><b>이메일로도 받기</b><small>인증한 회원 이메일로 선택한 일정을 보내드려요.</small></span>
              <input type="checkbox" disabled={!preferenceLoaded || saving || sessionExpired} checked={preference.emailEnabled} onChange={(event) => setPreference((current) => ({ ...current, emailEnabled: event.target.checked }))} />
            </label>
            <label className="email-notification-option">
              <span><b>앱 푸시로 받기</b><small>하이브리드 앱에서 알림 권한과 기기를 등록한 경우에만 발송돼요.</small></span>
              <input type="checkbox" disabled={!preferenceLoaded || saving || sessionExpired} checked={preference.appPushEnabled} onChange={(event) => setPreference((current) => ({ ...current, appPushEnabled: event.target.checked }))} />
            </label>
            <div className="notification-channel-status" aria-label="외부 알림 채널 상태">
              <b>알림 채널 연결 상태</b>
              <p>수신 설정과 실제 발송 연결은 별도입니다. 문자·알림톡은 업체 연결 전까지 발송하지 않아요.</p>
              {channels.map((channel) => (
                <div key={channel.id}>
                  <span>{channel.label}</span><em className={channel.available ? "ready" : "pending"}>{channel.available ? "설정됨" : "준비 중"}</em>
                  <small>{channel.message}</small>
                </div>
              ))}
            </div>
            <button className="primary-button" type="submit" disabled={saving || busyId !== undefined || !preferenceLoaded || sessionExpired}>{saving ? "저장 중…" : "알림 설정 저장"}</button>
          </form>
        )}
        {notice && <p className="member-message success" role="status">{notice}</p>}
        {error && <p className="member-message error" role="alert">{error}</p>}
        {sessionExpired && <p className="member-message error" role="alert">로그인이 만료되었거나 접근 권한이 없습니다. 다시 로그인한 뒤 알림 창을 열어주세요.</p>}
      </section>
    </div>
  );
}
