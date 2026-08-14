package com.cheongyakone.api;

import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SubscriptionNotice;

import java.math.BigDecimal;
import java.time.LocalDate;

public record NoticeSummaryResponse(
        Long id,
        HousingCategory housingCategory,
        NoticeStatus status,
        String title,
        String regionCode,
        String address,
        LocalDate applyStartDate,
        LocalDate applyEndDate,
        Integer totalUnits,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        String officialUrl
) {
    public static NoticeSummaryResponse from(SubscriptionNotice notice) {
        return new NoticeSummaryResponse(
                notice.getId(),
                notice.getHousingCategory(),
                notice.getStatus(),
                notice.getTitle(),
                notice.getRegionCode(),
                notice.getAddress(),
                notice.getApplyStartDate(),
                notice.getApplyEndDate(),
                notice.getTotalUnits(),
                notice.getMinPrice(),
                notice.getMaxPrice(),
                notice.getOfficialUrl()
        );
    }
}
