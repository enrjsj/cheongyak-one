package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.NotificationType;

import java.time.Instant;
import java.time.LocalDate;

public record MemberNotificationResponse(
        Long id,
        Long noticeId,
        String noticeTitle,
        NotificationType type,
        String message,
        LocalDate eventDate,
        Instant createdAt,
        Instant readAt
) {

    public static MemberNotificationResponse from(MemberNotification notification) {
        return new MemberNotificationResponse(
                notification.getId(),
                notification.getNoticeId(),
                notification.getNoticeTitle(),
                notification.getType(),
                notification.getType().message(),
                notification.getEventDate(),
                notification.getCreatedAt(),
                notification.getReadAt()
        );
    }

}
