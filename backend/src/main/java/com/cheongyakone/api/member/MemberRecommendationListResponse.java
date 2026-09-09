package com.cheongyakone.api.member;

import java.time.Instant;
import java.util.List;

public record MemberRecommendationListResponse(
        boolean configured,
        Instant preferenceUpdatedAt,
        long dismissedCount,
        List<MemberRecommendationResponse> recommendations
) {

    public static MemberRecommendationListResponse notConfigured() {
        return new MemberRecommendationListResponse(false, null, 0, List.of());
    }
}
