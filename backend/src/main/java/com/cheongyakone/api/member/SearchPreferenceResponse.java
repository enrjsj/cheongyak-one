package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.MemberSearchPreference;
import com.cheongyakone.domain.member.SearchPreferenceSort;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.HousingCategory;

import java.time.Instant;

public record SearchPreferenceResponse(
        String region,
        HousingCategory housingCategory,
        SearchPreferenceStatus status,
        SearchPreferenceSort sort,
        Instant updatedAt
) {
    public static SearchPreferenceResponse from(MemberSearchPreference preference) {
        return new SearchPreferenceResponse(
                preference.getRegion(),
                preference.getHousingCategory(),
                preference.getStatus(),
                preference.getSort(),
                preference.getUpdatedAt()
        );
    }
}
