package com.cheongyakone.api;

import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.sync.SourceSyncStatus;
import java.time.Instant;

/** Public collection metadata only: no upstream errors, URLs or credentials. */
public record SourceFreshnessResponse(
        SourceSystem sourceSystem, boolean configured, NoticeFreshnessStatus status,
        Instant lastSuccessfulAt, Instant lastAttemptAt, SourceSyncStatus lastAttemptStatus,
        int fetchedCount, int savedCount, int failedNoticeCount,
        int failedUnitTypeCount, int emptyUnitTypeCount, boolean unitTypesDisabled,
        boolean retryRecommended
) { }
