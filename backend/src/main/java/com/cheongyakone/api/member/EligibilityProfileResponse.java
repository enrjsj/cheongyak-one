package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.EligibilityAnswer;
import com.cheongyakone.domain.member.MemberEligibilityProfile;

import java.time.Instant;

public record EligibilityProfileResponse(
        EligibilityAnswer homeless,
        EligibilityAnswer subscriptionAccount,
        EligibilityAnswer newlywed,
        EligibilityAnswer firstHome,
        Instant updatedAt
) {
    public static EligibilityProfileResponse from(MemberEligibilityProfile profile) {
        return new EligibilityProfileResponse(profile.getHomeless(), profile.getSubscriptionAccount(),
                profile.getNewlywed(), profile.getFirstHome(), profile.getUpdatedAt());
    }
}
