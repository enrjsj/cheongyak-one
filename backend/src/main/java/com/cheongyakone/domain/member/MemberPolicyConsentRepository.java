package com.cheongyakone.domain.member;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberPolicyConsentRepository extends JpaRepository<MemberPolicyConsent, Long> {
    List<MemberPolicyConsent> findAllByMember_IdOrderByAgreedAtDesc(Long memberId);
}
