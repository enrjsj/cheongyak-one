package com.cheongyakone.domain.sync;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SyncExecutionTest {

    @Test
    void storesPartialCountsAndMasksSecretsBeforePersistence() {
        SyncExecution execution = SyncExecution.start(Instant.parse("2026-09-09T00:00:00Z"));

        execution.partiallySucceed(
                Instant.parse("2026-09-09T00:00:10Z"),
                12,
                10,
                "REB_APT: request failed serviceKey=raw-secret&code=500"
        );

        assertThat(execution.getStatus()).isEqualTo(SyncExecutionStatus.PARTIALLY_SUCCEEDED);
        assertThat(execution.getFetchedCount()).isEqualTo(12);
        assertThat(execution.getSavedCount()).isEqualTo(10);
        assertThat(execution.getErrorMessage()).contains("serviceKey=***").doesNotContain("raw-secret");
    }
}
