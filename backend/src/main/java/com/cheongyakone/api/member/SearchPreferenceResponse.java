package com.cheongyakone.api.member;

import com.cheongyakone.domain.member.MemberSearchPreference;
import com.cheongyakone.domain.member.SearchPreferenceSort;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.SupplyType;

import java.time.Instant;
import java.math.BigDecimal;

public record SearchPreferenceResponse(
        String region,
        HousingCategory housingCategory,
        SupplyType supplyType,
        SearchPreferenceStatus status,
        SearchPreferenceSort sort,
        Integer minPriceManwon,
        Integer maxPriceManwon,
        BigDecimal minArea,
        BigDecimal maxArea,
        Instant updatedAt
) {
    public static SearchPreferenceResponse from(MemberSearchPreference preference) {
        return new SearchPreferenceResponse(
                preference.getRegion(),
                preference.getHousingCategory(),
                preference.getSupplyType(),
                preference.getStatus(),
                preference.getSort(),
                preference.getMinPriceManwon(),
                preference.getMaxPriceManwon(),
                preference.getMinArea(),
                preference.getMaxArea(),
                preference.getUpdatedAt()
        );
    }
}
