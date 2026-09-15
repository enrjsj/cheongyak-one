package com.cheongyakone.api.admin;

import com.cheongyakone.domain.member.MemberNotification;

import java.time.Instant;
import java.util.List;

public record AdminPushNotificationResponse(
        long registeredDeviceCount,
        long pendingCount,
        long permanentlyFailedCount,
        long sentLast24Hours,
        List<Failure> recentFailures,
        Instant generatedAt
) {
    public record Failure(long notificationId, String noticeTitle, String type, int attempts, String error, Instant nextAttemptAt) {
        public static Failure from(MemberNotification notification) {
            return new Failure(notification.getId(), notification.getNoticeTitle(), notification.getType().name(),
                    notification.getPushAttempts(), notification.getPushLastError(), notification.getPushNextAttemptAt());
        }
    }
}
