package com.cheongyakone.api;

import com.cheongyakone.domain.notice.SubscriptionNoticeUnitType;
import java.math.BigDecimal;

public record NoticeUnitTypeResponse(String modelId, String housingTypeName, BigDecimal supplyArea, Integer generalSupplyCount,
                                     Integer specialSupplyCount, Integer totalSupplyCount, BigDecimal maxPrice) {
    public static NoticeUnitTypeResponse from(SubscriptionNoticeUnitType value) {
        return new NoticeUnitTypeResponse(value.getSourceModelId(), value.getHousingTypeName(), value.getSupplyArea(), value.getGeneralSupplyCount(), value.getSpecialSupplyCount(), value.getTotalSupplyCount(), value.getMaxPrice());
    }
}
