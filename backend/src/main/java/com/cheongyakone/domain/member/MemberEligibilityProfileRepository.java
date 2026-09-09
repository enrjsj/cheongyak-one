package com.cheongyakone.domain.member;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberEligibilityProfileRepository extends JpaRepository<MemberEligibilityProfile, Long> {
    Optional<MemberEligibilityProfile> findByMemberId(Long memberId);
    void deleteByMemberId(Long memberId);
}
