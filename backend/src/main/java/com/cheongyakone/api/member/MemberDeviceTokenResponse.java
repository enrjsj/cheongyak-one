package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.MemberDeviceToken;

import java.time.Instant;

public record MemberDeviceTokenResponse(
        long id,
        String platform,
        Instant createdAt,
        Instant updatedAt,
        Instant lastSeenAt
) {
    public static MemberDeviceTokenResponse from(MemberDeviceToken token) {
        return new MemberDeviceTokenResponse(token.getId(), token.getPlatform().name(), token.getCreatedAt(), token.getUpdatedAt(), token.getLastSeenAt());
    }
}
