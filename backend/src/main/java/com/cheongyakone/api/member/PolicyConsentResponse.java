package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.MemberPolicyConsent;
import com.cheongyakone.domain.member.MemberPolicyType;
import java.time.Instant;

public record PolicyConsentResponse(MemberPolicyType policyType, String policyVersion, Instant agreedAt) {
    public static PolicyConsentResponse from(MemberPolicyConsent consent) {
        return new PolicyConsentResponse(consent.getPolicyType(), consent.getPolicyVersion(), consent.getAgreedAt());
    }
}
