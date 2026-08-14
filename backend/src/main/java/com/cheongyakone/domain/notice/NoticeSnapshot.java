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
        String contentHash
) {
}
