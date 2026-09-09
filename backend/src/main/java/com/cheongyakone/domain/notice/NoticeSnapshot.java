package com.cheongyakone.domain.notice;

import java.math.BigDecimal;
import java.time.LocalDate;

public record NoticeSnapshot(
        SourceSystem sourceSystem,
        String sourceNoticeId,
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
        String contentHash
) {

    public NoticeSnapshot(
            SourceSystem sourceSystem,
            String sourceNoticeId,
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
            String contentHash
    ) {
        this(
                sourceSystem,
                sourceNoticeId,
                housingCategory,
                status,
                title,
                regionCode,
                address,
                noticeDate,
                applyStartDate,
                applyEndDate,
                winnerAnnounceDate,
                totalUnits,
                minPrice,
                maxPrice,
                officialUrl,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                contentHash
        );
    }
}
