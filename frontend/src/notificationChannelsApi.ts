export type NotificationChannelId = "EMAIL" | "APP_PUSH" | "KAKAO_ALIMTALK" | "SMS";

export interface NotificationChannelAvailability {
  id: NotificationChannelId;
  label: string;
  available: boolean;
  message: string;
}

interface NotificationChannelAvailabilityResponse {
  channels: NotificationChannelAvailability[];
}

export async function fetchNotificationChannelAvailability(): Promise<NotificationChannelAvailabilityResponse> {
  const response = await fetch("/api/v1/members/me/notifications/channels", { credentials: "include" });
  if (!response.ok) throw new Error("알림 채널 상태를 불러오지 못했습니다.");
  return response.json() as Promise<NotificationChannelAvailabilityResponse>;
}
