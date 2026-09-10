package com.cheongyakone.api.admin;

import java.time.Instant;
import java.util.List;

public record AdminMemberStatisticsResponse(
        long activeMemberCount,
        long consentedProfileCount,
        List<Bucket> genders,
        List<Bucket> ageGroups,
        List<Bucket> maritalStatuses,
        List<Bucket> residenceRegions,
        List<Bucket> householdSizes,
        List<Bucket> childCounts,
        Instant generatedAt
) {
    public record Bucket(String key, String label, long count) {
    }
}
