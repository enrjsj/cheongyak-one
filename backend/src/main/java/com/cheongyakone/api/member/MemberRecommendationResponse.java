package com.cheongyakone.api.member;

import com.cheongyakone.api.NoticeSummaryResponse;

import java.util.List;

public record MemberRecommendationResponse(
        int score,
        List<String> reasons,
        NoticeSummaryResponse notice
) {
}
