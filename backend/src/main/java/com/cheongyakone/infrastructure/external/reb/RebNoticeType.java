package com.cheongyakone.infrastructure.external.reb;

import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.SourceSystem;

enum RebNoticeType {
    APARTMENT(
            "getAPTLttotPblancDetail",
            SourceSystem.REB_APT,
            HousingCategory.APARTMENT
    ),
    OFFICETEL(
            "getUrbtyOfctlLttotPblancDetail",
            SourceSystem.REB_OFFICETEL,
            HousingCategory.OFFICETEL
    );

    private final String endpoint;
    private final SourceSystem sourceSystem;
    private final HousingCategory housingCategory;

    RebNoticeType(String endpoint, SourceSystem sourceSystem, HousingCategory housingCategory) {
        this.endpoint = endpoint;
        this.sourceSystem = sourceSystem;
        this.housingCategory = housingCategory;
    }

    String endpoint() {
        return endpoint;
    }

    SourceSystem sourceSystem() {
        return sourceSystem;
    }

    HousingCategory housingCategory() {
        return housingCategory;
    }
}
