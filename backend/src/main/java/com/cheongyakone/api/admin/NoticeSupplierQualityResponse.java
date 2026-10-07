package com.cheongyakone.api.admin;

import com.cheongyakone.domain.notice.SourceSystem;

public record NoticeSupplierQualityResponse(SourceSystem sourceSystem, long totalCount, long missingSupplierCount) {
}
