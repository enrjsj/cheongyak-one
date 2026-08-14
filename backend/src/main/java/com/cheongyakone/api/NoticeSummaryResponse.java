package com.cheongyakone.api;

import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNotice;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record NoticeSummaryResponse(
        Long id,
        SourceSystem sourceSystem,
        HousingCategory housingCategory,
        NoticeStatus status,
        String title,
        String regionCode,
        String address,
        LocalDate noticeDate,
        LocalDate applyStartDate,
        LocalDate applyEndDate,
        LocalDate winnerAnnounceDate,
        Integer totalUnits,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        String officialUrl,
        Instant syncedAt
) {
    public static NoticeSummaryResponse from(SubscriptionNotice notice) {
        return new NoticeSummaryResponse(
                notice.getId(),
                notice.getSourceSystem(),
                notice.getHousingCategory(),
                notice.getStatus(),
                notice.getTitle(),
                notice.getRegionCode(),
                notice.getAddress(),
                notice.getNoticeDate(),
                notice.getApplyStartDate(),
                notice.getApplyEndDate(),
                notice.getWinnerAnnounceDate(),
                notice.getTotalUnits(),
                notice.getMinPrice(),
                notice.getMaxPrice(),
                notice.getOfficialUrl(),
                notice.getSyncedAt()
        );
    }
}
