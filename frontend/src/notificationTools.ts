import type { MemberNotification, MemberNotificationType } from "./api";

export type NotificationFilter = "ALL" | "UNREAD" | "SCHEDULE" | "NEW" | "UPDATED";
export type NotificationSort = "NEWEST" | "UNREAD_FIRST";

export function searchAndSortNotifications(notifications: MemberNotification[], query: string, sort: NotificationSort): MemberNotification[] {
  const terms = query.normalize("NFKC").toLocaleLowerCase("ko-KR").trim().split(/\s+/).filter(Boolean);
  const timestamp = (value: string) => {
    const result = Date.parse(value);
    return Number.isFinite(result) ? result : 0;
  };
  return notifications.filter(item => {
    const text = `${item.noticeTitle} ${item.message}`.normalize("NFKC").toLocaleLowerCase("ko-KR");
    return terms.every(term => text.includes(term));
  }).sort((a, b) => {
    if (sort === "UNREAD_FIRST" && Boolean(a.readAt) !== Boolean(b.readAt)) return a.readAt ? 1 : -1;
    return timestamp(b.createdAt) - timestamp(a.createdAt) || b.id - a.id;
  });
}

export interface NotificationFilterOption {
  value: NotificationFilter;
  label: string;
}

export function notificationCategory(type: MemberNotificationType): Exclude<NotificationFilter, "ALL" | "UNREAD"> {
  if (type === "NEW_MATCHING_NOTICE") return "NEW";
  if (type === "NOTICE_UPDATED") return "UPDATED";
  return "SCHEDULE";
}

export function notificationCategoryLabel(type: MemberNotificationType): string {
  switch (type) {
    case "NEW_MATCHING_NOTICE": return "신규 공고";
    case "NOTICE_UPDATED": return "공고 변경";
    case "APPLY_START": return "접수 시작";
    case "APPLY_DEADLINE_7D": return "마감 7일 전";
    case "APPLY_DEADLINE_3D": return "마감 3일 전";
    case "APPLY_DEADLINE_1D": return "마감 1일 전";
    case "WINNER_ANNOUNCEMENT": return "당첨자 발표";
  }
}

export function filterNotifications(notifications: MemberNotification[], filter: NotificationFilter): MemberNotification[] {
  if (filter === "ALL") return notifications;
  if (filter === "UNREAD") return notifications.filter((notification) => !notification.readAt);
  return notifications.filter((notification) => notificationCategory(notification.type) === filter);
}

export function notificationFilterOptions(notifications: MemberNotification[]): NotificationFilterOption[] {
  const count = (filter: NotificationFilter) => filterNotifications(notifications, filter).length;
  return [
    { value: "ALL", label: `전체 ${count("ALL")}` },
    { value: "UNREAD", label: `읽지 않음 ${count("UNREAD")}` },
    { value: "SCHEDULE", label: `일정 ${count("SCHEDULE")}` },
    { value: "NEW", label: `신규 ${count("NEW")}` },
    { value: "UPDATED", label: `변경 ${count("UPDATED")}` },
  ];
}
