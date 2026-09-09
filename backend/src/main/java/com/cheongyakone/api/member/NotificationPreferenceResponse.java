package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.MemberNotificationPreference;

import java.time.Instant;

public record NotificationPreferenceResponse(
        boolean applyStartEnabled,
        boolean deadline7dEnabled,
        boolean deadline3dEnabled,
        boolean deadline1dEnabled,
        boolean winnerEnabled,
        boolean newMatchingNoticeEnabled,
        boolean noticeUpdatedEnabled,
        boolean emailEnabled,
        Instant updatedAt
) {

    public static NotificationPreferenceResponse defaults() {
        return new NotificationPreferenceResponse(true, true, true, true, true, true, true, false, null);
    }

    public static NotificationPreferenceResponse from(MemberNotificationPreference preference) {
        return new NotificationPreferenceResponse(
                preference.isApplyStartEnabled(),
                preference.isDeadline7dEnabled(),
                preference.isDeadline3dEnabled(),
                preference.isDeadline1dEnabled(),
                preference.isWinnerEnabled(),
                preference.isNewMatchingNoticeEnabled(),
                preference.isNoticeUpdatedEnabled(),
                preference.isEmailEnabled(),
                preference.getUpdatedAt()
        );
    }
}
