package com.cheongyakone.infrastructure.external.reb;

import java.math.BigDecimal;

public record RebApartmentUnitTypeSnapshot(
        String modelId,
        String housingTypeName,
        BigDecimal supplyArea,
        Integer generalSupplyCount,
        Integer specialSupplyCount,
        Integer totalSupplyCount,
        BigDecimal maxPrice
) { }
