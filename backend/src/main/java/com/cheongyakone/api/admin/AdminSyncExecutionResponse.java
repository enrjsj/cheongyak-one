package com.cheongyakone.api.admin;

import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.domain.sync.SyncExecutionStatus;

import java.time.Duration;
import java.time.Instant;
import java.util.regex.Pattern;

public record AdminSyncExecutionResponse(
        Long id,
        SyncExecutionStatus status,
        Instant startedAt,
        Instant finishedAt,
        Long durationSeconds,
        int fetchedCount,
        int savedCount,
        String errorMessage
) {

    private static final Pattern SECRET_QUERY_PARAMETER = Pattern.compile(
            "(?i)(serviceKey|apiKey|token|secret)=([^&\\s]+)"
    );

    public static AdminSyncExecutionResponse from(SyncExecution execution) {
        Long durationSeconds = execution.getFinishedAt() == null
                ? null
                : Math.max(0, Duration.between(execution.getStartedAt(), execution.getFinishedAt()).toSeconds());
        return new AdminSyncExecutionResponse(
                execution.getId(),
                execution.getStatus(),
                execution.getStartedAt(),
                execution.getFinishedAt(),
                durationSeconds,
                execution.getFetchedCount(),
                execution.getSavedCount(),
                sanitize(execution.getErrorMessage())
        );
    }

    private static String sanitize(String message) {
        return message == null ? null : SECRET_QUERY_PARAMETER.matcher(message).replaceAll("$1=***");
    }
}
