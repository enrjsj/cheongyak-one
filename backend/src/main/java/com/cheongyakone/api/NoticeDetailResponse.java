package com.cheongyakone.api;

import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNotice;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record NoticeDetailResponse(
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
        Instant syncedAt,
        String postalCode,
        String housingDetailType,
        String rentType,
        String businessEntityName,
        String constructionCompanyName,
        String contactPhone,
        String homepageUrl,
        String moveInPlannedMonth,
        LocalDate specialSupplyStartDate,
        LocalDate specialSupplyEndDate,
        LocalDate contractStartDate,
        LocalDate contractEndDate,
        Instant contentChangedAt,
        String lastChangeSummary
) {

    public static NoticeDetailResponse from(SubscriptionNotice notice) {
        return new NoticeDetailResponse(
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
                notice.getSyncedAt(),
                notice.getPostalCode(),
                notice.getHousingDetailType(),
                notice.getRentType(),
                notice.getBusinessEntityName(),
                notice.getConstructionCompanyName(),
                notice.getContactPhone(),
                notice.getHomepageUrl(),
                notice.getMoveInPlannedMonth(),
                notice.getSpecialSupplyStartDate(),
                notice.getSpecialSupplyEndDate(),
                notice.getContractStartDate(),
                notice.getContractEndDate(),
                notice.getContentChangedAt(),
                notice.getLastChangeSummary()
        );
    }
}
