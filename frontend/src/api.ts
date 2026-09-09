export type SourceSystem = "REB_APT" | "REB_OFFICETEL" | "MYHOME_PUBLIC_RENTAL";
export type HousingCategory = "APARTMENT" | "PUBLIC_RENTAL" | "OFFICETEL";
export type NoticeStatus = "UPCOMING" | "OPEN" | "CLOSED" | "ANNOUNCED";

export interface NoticeSummary {
  id: number;
  sourceSystem: SourceSystem;
  housingCategory: HousingCategory;
  status: NoticeStatus;
  title: string;
  regionCode?: string;
  address?: string;
  noticeDate?: string;
  applyStartDate?: string;
  applyEndDate?: string;
  winnerAnnounceDate?: string;
  totalUnits?: number;
  minPrice?: number;
  maxPrice?: number;
  officialUrl?: string;
  syncedAt: string;
}

export interface NoticeDetail extends NoticeSummary {
  postalCode?: string;
  housingDetailType?: string;
  rentType?: string;
  businessEntityName?: string;
  constructionCompanyName?: string;
  contactPhone?: string;
  homepageUrl?: string;
  moveInPlannedMonth?: string;
  specialSupplyStartDate?: string;
  specialSupplyEndDate?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contentChangedAt?: string;
  lastChangeSummary?: string;
}

export interface NoticeChange {
  id: number;
  summary: string;
  changedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface NoticeSearchFacets {
  total: number;
  endingToday: number;
  open: number;
  upcoming: number;
}

export interface NoticeSearchRequest {
  category?: HousingCategory;
  status?: NoticeStatus;
  keyword?: string;
  region?: string;
  ids?: number[];
  endingToday?: boolean;
  sort?: "LATEST" | "DEADLINE";
  page?: number;
  size?: number;
}

export interface MemberProfile {
  id: number;
  email: string;
  nickname: string;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  createdAt: string;
}

export type SyncExecutionStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export interface AdminSyncExecution {
  id: number;
  status: SyncExecutionStatus;
  startedAt: string;
  finishedAt?: string | null;
  durationSeconds?: number | null;
  fetchedCount: number;
  savedCount: number;
  errorMessage?: string | null;
}

export interface AdminSyncDashboard {
  generatedAt: string;
  runningCount: number;
  failuresLast24Hours: number;
  lastSuccessfulAt?: string | null;
  executions: AdminSyncExecution[];
}

export type AdminMemberStatus = "ACTIVE" | "SUSPENDED" | "WITHDRAWN";

export interface AdminMember {
  id: number;
  email: string;
  nickname: string;
  status: AdminMemberStatus;
  role: "USER" | "ADMIN";
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string | null;
  suspendedAt?: string | null;
  activeSessionCount: number;
  createdAt: string;
}

export interface AdminMemberPage {
  members: AdminMember[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type AdminAuditAction = "MEMBER_LOGIN_UNLOCKED" | "MEMBER_SESSIONS_REVOKED" | "MEMBER_SUSPENDED" | "MEMBER_REACTIVATED";

export interface AdminAuditLog {
  id: number;
  actorMemberId: number;
  actorEmail: string;
  targetMemberId: number;
  targetEmail: string;
  action: AdminAuditAction;
  affectedCount: number;
  details?: string | null;
  createdAt: string;
}

export interface MemberSession {
  id: number;
  clientName: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export type MemberNotificationType =
  | "APPLY_START"
  | "APPLY_DEADLINE_7D"
  | "APPLY_DEADLINE_3D"
  | "APPLY_DEADLINE_1D"
  | "WINNER_ANNOUNCEMENT"
  | "NEW_MATCHING_NOTICE"
  | "NOTICE_UPDATED";

export interface MemberNotification {
  id: number;
  noticeId: number;
  noticeTitle: string;
  type: MemberNotificationType;
  message: string;
  eventDate: string;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationInbox {
  notifications: MemberNotification[];
  unreadCount: number;
}

export interface NotificationPreference {
  applyStartEnabled: boolean;
  deadline7dEnabled: boolean;
  deadline3dEnabled: boolean;
  deadline1dEnabled: boolean;
  winnerEnabled: boolean;
  newMatchingNoticeEnabled: boolean;
  noticeUpdatedEnabled: boolean;
  emailEnabled: boolean;
  updatedAt?: string | null;
}

export interface MemberRecommendation {
  score: number;
  reasons: string[];
  notice: NoticeSummary;
}

export interface MemberRecommendationList {
  configured: boolean;
  preferenceUpdatedAt?: string | null;
  dismissedCount: number;
  recommendations: MemberRecommendation[];
}

export type SearchPreferenceStatus = "ALL" | "TODAY" | "OPEN" | "UPCOMING";
export type SearchPreferenceSort = "LATEST" | "DEADLINE";

export interface MemberSearchPreference {
  region?: string;
  housingCategory?: HousingCategory;
  status: SearchPreferenceStatus;
  sort: SearchPreferenceSort;
  updatedAt: string;
}

export interface SearchPreferenceInput {
  region?: string;
  housingCategory?: HousingCategory;
  status: SearchPreferenceStatus;
  sort: SearchPreferenceSort;
}

interface FavoriteIdsResponse {
  noticeIds: number[];
}

interface ComparisonIdsResponse {
  noticeIds: number[];
}

class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function cookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = cookieValue("CHEONGYAK_CSRF");
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }
  const response = await fetch(url, {
    ...init,
    headers,
    // HttpOnly 회원 세션을 동일 출처 API 요청에 자동으로 포함한다.
    credentials: "include",
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => undefined) as { detail?: string } | undefined;
    throw new ApiError(response.status, problem?.detail ?? (response.status === 404
      ? "요청한 정보를 찾지 못했습니다."
      : "요청을 처리하지 못했습니다."));
  }

  if (response.status === 204) return undefined as T;
  const body = await response.text();
  if (!body.trim()) return undefined as T;
  return JSON.parse(body) as T;
}

export async function fetchNotices(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<PageResponse<NoticeSummary>> {
  return requestJson<PageResponse<NoticeSummary>>(`/api/v1/notices?${params.toString()}`, { signal });
}

export function noticeSearchParams(request: NoticeSearchRequest): URLSearchParams {
  const params = new URLSearchParams({
    page: String(request.page ?? 0),
    size: String(request.size ?? 24),
    sort: request.sort ?? "LATEST",
  });
  if (request.category) params.set("category", request.category);
  if (request.status) params.set("status", request.status);
  if (request.keyword?.trim()) params.set("keyword", request.keyword.trim());
  if (request.region?.trim()) params.set("region", request.region.trim());
  if (request.ids?.length) request.ids.forEach((id) => params.append("ids", String(id)));
  if (request.endingToday) params.set("endingToday", "true");
  return params;
}

export function fetchNoticePage(request: NoticeSearchRequest, signal?: AbortSignal): Promise<PageResponse<NoticeSummary>> {
  return fetchNotices(noticeSearchParams(request), signal);
}

export function fetchNoticeFacets(request: Pick<NoticeSearchRequest, "category" | "keyword" | "region">, signal?: AbortSignal): Promise<NoticeSearchFacets> {
  const params = noticeSearchParams({ ...request, page: 0, size: 1 });
  params.delete("page");
  params.delete("size");
  params.delete("sort");
  return requestJson<NoticeSearchFacets>(`/api/v1/notices/facets?${params.toString()}`, { signal });
}

export async function fetchNotice(id: number, signal?: AbortSignal): Promise<NoticeDetail> {
  return requestJson<NoticeDetail>(`/api/v1/notices/${id}`, { signal });
}

export async function fetchNoticeChanges(id: number, signal?: AbortSignal): Promise<NoticeChange[]> {
  return requestJson<NoticeChange[]>(`/api/v1/notices/${id}/changes`, { signal });
}

export async function fetchCurrentMember(): Promise<MemberProfile | undefined> {
  try {
    return await requestJson<MemberProfile>("/api/v1/members/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return undefined;
    throw error;
  }
}

export function signupMember(email: string, password: string, nickname: string): Promise<MemberProfile> {
  return requestJson<MemberProfile>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, nickname }),
  });
}

export function loginMember(email: string, password: string): Promise<MemberProfile> {
  return requestJson<MemberProfile>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logoutMember(): Promise<void> {
  return requestJson<void>("/api/v1/auth/logout", { method: "POST" });
}

export function requestEmailVerification(email: string): Promise<void> {
  return requestJson<void>("/api/v1/auth/email-verification/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmEmailVerification(token: string): Promise<void> {
  return requestJson<void>("/api/v1/auth/email-verification/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function requestPasswordReset(email: string): Promise<void> {
  return requestJson<void>("/api/v1/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  return requestJson<void>("/api/v1/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export function updateMemberProfile(nickname: string): Promise<MemberProfile> {
  return requestJson<MemberProfile>("/api/v1/members/me", {
    method: "PATCH",
    body: JSON.stringify({ nickname }),
  });
}

export function changeMemberPassword(currentPassword: string, newPassword: string): Promise<void> {
  return requestJson<void>("/api/v1/members/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function withdrawMember(password: string): Promise<void> {
  return requestJson<void>("/api/v1/members/me", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

export async function fetchFavoriteIds(): Promise<number[]> {
  return (await requestJson<FavoriteIdsResponse>("/api/v1/members/me/favorites")).noticeIds;
}

export async function mergeFavoriteIds(noticeIds: number[]): Promise<number[]> {
  if (noticeIds.length === 0) return fetchFavoriteIds();
  return (await requestJson<FavoriteIdsResponse>("/api/v1/members/me/favorites/merge", {
    method: "POST",
    body: JSON.stringify({ noticeIds }),
  })).noticeIds;
}

export async function setFavorite(id: number, saved: boolean): Promise<number[]> {
  return (await requestJson<FavoriteIdsResponse>(`/api/v1/members/me/favorites/${id}`, {
    method: saved ? "PUT" : "DELETE",
  })).noticeIds;
}

export async function fetchComparisonIds(): Promise<number[]> {
  return (await requestJson<ComparisonIdsResponse>("/api/v1/members/me/comparisons")).noticeIds;
}

export async function mergeComparisonIds(noticeIds: number[]): Promise<number[]> {
  if (noticeIds.length === 0) return fetchComparisonIds();
  return (await requestJson<ComparisonIdsResponse>("/api/v1/members/me/comparisons/merge", {
    method: "POST",
    body: JSON.stringify({ noticeIds: noticeIds.slice(0, 3) }),
  })).noticeIds;
}

export async function setComparison(id: number, selected: boolean): Promise<number[]> {
  return (await requestJson<ComparisonIdsResponse>(`/api/v1/members/me/comparisons/${id}`, {
    method: selected ? "PUT" : "DELETE",
  })).noticeIds;
}

export async function clearComparisons(): Promise<number[]> {
  return (await requestJson<ComparisonIdsResponse>("/api/v1/members/me/comparisons", {
    method: "DELETE",
  })).noticeIds;
}

export function fetchSearchPreference(): Promise<MemberSearchPreference | undefined> {
  return requestJson<MemberSearchPreference | undefined>("/api/v1/members/me/search-preference");
}

export function saveSearchPreference(input: SearchPreferenceInput): Promise<MemberSearchPreference> {
  return requestJson<MemberSearchPreference>("/api/v1/members/me/search-preference", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteSearchPreference(): Promise<void> {
  return requestJson<void>("/api/v1/members/me/search-preference", { method: "DELETE" });
}

export function fetchMemberSessions(): Promise<MemberSession[]> {
  return requestJson<MemberSession[]>("/api/v1/members/me/sessions");
}

export function revokeMemberSession(sessionId: number): Promise<void> {
  return requestJson<void>(`/api/v1/members/me/sessions/${sessionId}`, { method: "DELETE" });
}

export function revokeOtherMemberSessions(): Promise<MemberSession[]> {
  return requestJson<MemberSession[]>("/api/v1/members/me/sessions/others", { method: "DELETE" });
}

export function fetchNotificationInbox(): Promise<NotificationInbox> {
  return requestJson<NotificationInbox>("/api/v1/members/me/notifications");
}

export function markNotificationRead(notificationId: number): Promise<MemberNotification> {
  return requestJson<MemberNotification>(`/api/v1/members/me/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead(): Promise<void> {
  return requestJson<void>("/api/v1/members/me/notifications/read-all", { method: "POST" });
}

export function fetchNotificationPreference(): Promise<NotificationPreference> {
  return requestJson<NotificationPreference>("/api/v1/members/me/notifications/preference");
}

export function saveNotificationPreference(
  preference: Omit<NotificationPreference, "updatedAt">,
): Promise<NotificationPreference> {
  return requestJson<NotificationPreference>("/api/v1/members/me/notifications/preference", {
    method: "PUT",
    body: JSON.stringify(preference),
  });
}

export function fetchMemberRecommendations(): Promise<MemberRecommendationList> {
  return requestJson<MemberRecommendationList>("/api/v1/members/me/recommendations");
}

export function dismissMemberRecommendation(noticeId: number): Promise<void> {
  return requestJson<void>(`/api/v1/members/me/recommendations/${noticeId}/dismiss`, { method: "POST" });
}

export function resetDismissedRecommendations(): Promise<void> {
  return requestJson<void>("/api/v1/members/me/recommendations/dismissed", { method: "DELETE" });
}

export function fetchAdminSyncDashboard(): Promise<AdminSyncDashboard> {
  return requestJson<AdminSyncDashboard>("/api/v1/admin/sync-executions");
}

export function fetchAdminMembers(
  query: string,
  status: AdminMemberStatus | "",
  page: number,
): Promise<AdminMemberPage> {
  const parameters = new URLSearchParams({ page: String(page), size: "20" });
  if (query.trim()) parameters.set("query", query.trim());
  if (status) parameters.set("status", status);
  return requestJson<AdminMemberPage>(`/api/v1/admin/members?${parameters}`);
}

export function unlockAdminMember(memberId: number): Promise<AdminMember> {
  return requestJson<AdminMember>(`/api/v1/admin/members/${memberId}/unlock`, { method: "POST" });
}

export function revokeAdminMemberSessions(memberId: number): Promise<void> {
  return requestJson<void>(`/api/v1/admin/members/${memberId}/sessions`, { method: "DELETE" });
}

export function suspendAdminMember(memberId: number, reason: string): Promise<AdminMember> {
  return requestJson<AdminMember>(`/api/v1/admin/members/${memberId}/suspend`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function reactivateAdminMember(memberId: number): Promise<AdminMember> {
  return requestJson<AdminMember>(`/api/v1/admin/members/${memberId}/reactivate`, { method: "POST" });
}

export function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  return requestJson<AdminAuditLog[]>("/api/v1/admin/audit-logs");
}
