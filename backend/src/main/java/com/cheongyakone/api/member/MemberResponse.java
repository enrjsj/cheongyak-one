package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberGender;
import com.cheongyakone.domain.member.MemberMaritalStatus;
import com.cheongyakone.domain.member.MemberRole;

import java.time.Instant;
import java.time.LocalDate;

public record MemberResponse(
        Long id,
        String email,
        String nickname,
        LocalDate birthDate,
        MemberGender gender,
        MemberMaritalStatus maritalStatus,
        Integer householdMemberCount,
        Integer childCount,
        String residenceRegion,
        MemberRole role,
        boolean emailVerified,
        Instant createdAt
) {
    public static MemberResponse from(Member member) {
        return new MemberResponse(
                member.getId(),
                member.getEmail(),
                member.getNickname(),
                member.getBirthDate(),
                member.getGender(),
                member.getMaritalStatus(),
                member.getHouseholdMemberCount(),
                member.getChildCount(),
                member.getResidenceRegion(),
                member.getRole(),
                member.isEmailVerified(),
                member.getCreatedAt()
        );
    }
}
