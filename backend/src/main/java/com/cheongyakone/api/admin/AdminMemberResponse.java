package com.cheongyakone.api.admin;

import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberRole;
import com.cheongyakone.domain.member.MemberStatus;

import java.time.Instant;

public record AdminMemberResponse(
        Long id,
        String email,
        String nickname,
        MemberStatus status,
        MemberRole role,
        boolean emailVerified,
        int failedLoginAttempts,
        Instant lockedUntil,
        Instant suspendedAt,
        long activeSessionCount,
        Instant createdAt
) {
    public static AdminMemberResponse from(Member member, long activeSessionCount) {
        return new AdminMemberResponse(
                member.getId(),
                member.getEmail(),
                member.getNickname(),
                member.getStatus(),
                member.getRole(),
                member.isEmailVerified(),
                member.getFailedLoginAttempts(),
                member.getLockedUntil(),
                member.getSuspendedAt(),
                activeSessionCount,
                member.getCreatedAt()
        );
    }
}
