package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberRole;

import java.time.Instant;

public record MemberResponse(
        Long id,
        String email,
        String nickname,
        MemberRole role,
        boolean emailVerified,
        Instant createdAt
) {
    public static MemberResponse from(Member member) {
        return new MemberResponse(
                member.getId(),
                member.getEmail(),
                member.getNickname(),
                member.getRole(),
                member.isEmailVerified(),
                member.getCreatedAt()
        );
    }
}
