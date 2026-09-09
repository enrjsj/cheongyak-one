package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.MemberLoginSession;

import java.time.Instant;

public record MemberSessionResponse(
        Long id,
        String clientName,
        Instant createdAt,
        Instant expiresAt,
        boolean current
) {

    public static MemberSessionResponse from(MemberLoginSession session, Long currentSessionId) {
        return new MemberSessionResponse(
                session.getId(),
                session.getClientName(),
                session.getCreatedAt(),
                session.getExpiresAt(),
                session.getId().equals(currentSessionId)
        );
    }
}
