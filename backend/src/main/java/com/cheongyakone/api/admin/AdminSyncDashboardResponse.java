package com.cheongyakone.api.admin;

import java.time.Instant;
import java.util.List;

public record AdminSyncDashboardResponse(
        Instant generatedAt,
        long runningCount,
        long failuresLast24Hours,
        Instant lastSuccessfulAt,
        List<AdminSyncExecutionResponse> executions
) {
}
