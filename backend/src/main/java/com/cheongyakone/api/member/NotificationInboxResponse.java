package com.cheongyakone.api.member;

import java.util.List;

public record NotificationInboxResponse(
        List<MemberNotificationResponse> notifications,
        long unreadCount,
        int page,
        int size,
        long totalElements,
        int totalPages,
        long snapshotId
) {
}
