package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.NoticeSupplierQualityResponse;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;

@Service
public class NoticeSupplierQualityService {
    // Includes JS trim whitespace so this agrees with the public card's fallback.
    private static final String BLANK_PATTERN = "^[\\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$";
    private final SubscriptionNoticeRepository notices;

    public NoticeSupplierQualityService(SubscriptionNoticeRepository notices) {
        this.notices = notices;
    }

    @Transactional(readOnly = true)
    public List<NoticeSupplierQualityResponse> summarize() {
        var counts = new EnumMap<SourceSystem, NoticeSupplierQualityResponse>(SourceSystem.class);
        for (var row : notices.summarizeSupplierQuality(BLANK_PATTERN)) {
            counts.put(row.getSourceSystem(), new NoticeSupplierQualityResponse(
                    row.getSourceSystem(), row.getTotalCount(), row.getMissingSupplierCount()));
        }
        return Arrays.stream(SourceSystem.values()).map(source -> counts.getOrDefault(source,
                new NoticeSupplierQualityResponse(source, 0, 0))).toList();
    }
}
