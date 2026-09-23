package com.cheongyakone.infrastructure.external.reb;

import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.SourceSystem;

enum RebNoticeType {
    APARTMENT(
            "getAPTLttotPblancDetail",
            "getAPTLttotPblancMdl",
            SourceSystem.REB_APT,
            HousingCategory.APARTMENT
    ),
    OFFICETEL(
            "getUrbtyOfctlLttotPblancDetail",
            "getUrbtyOfctlLttotPblancMdl",
            SourceSystem.REB_OFFICETEL,
            HousingCategory.OFFICETEL
    );

    private final String endpoint;
    private final String unitTypeEndpoint;
    private final SourceSystem sourceSystem;
    private final HousingCategory housingCategory;

    RebNoticeType(String endpoint, String unitTypeEndpoint, SourceSystem sourceSystem, HousingCategory housingCategory) {
        this.endpoint = endpoint;
        this.unitTypeEndpoint = unitTypeEndpoint;
        this.sourceSystem = sourceSystem;
        this.housingCategory = housingCategory;
    }

    String endpoint() {
        return endpoint;
    }

    String unitTypeEndpoint() { return unitTypeEndpoint; }

    SourceSystem sourceSystem() {
        return sourceSystem;
    }

    HousingCategory housingCategory() {
        return housingCategory;
    }
}
