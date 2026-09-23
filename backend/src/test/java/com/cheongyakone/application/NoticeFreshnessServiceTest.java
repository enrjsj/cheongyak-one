package com.cheongyakone.application;

import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import com.cheongyakone.domain.sync.SyncExecutionStatus;
import com.cheongyakone.api.NoticeFreshnessStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoticeFreshnessServiceTest {

    @Mock
    private SyncExecutionRepository executionRepository;

    @Test
    void returnsLatestCompletedSynchronizationTimeIncludingPartialSuccess() {
        Instant completedAt = Instant.parse("2026-09-22T03:20:00Z");
        SyncExecution execution = SyncExecution.start(completedAt.minusSeconds(20));
        execution.partiallySucceed(completedAt, 20, 18, "MYHOME source timed out");
        when(executionRepository.findFirstByStatusInOrderByFinishedAtDesc(List.of(
                SyncExecutionStatus.SUCCEEDED,
                SyncExecutionStatus.PARTIALLY_SUCCEEDED
        ))).thenReturn(Optional.of(execution));

        NoticeFreshnessService service = new NoticeFreshnessService(executionRepository,
                Clock.fixed(Instant.parse("2026-09-22T04:00:00Z"), ZoneOffset.UTC));

        var response = service.freshness();

        assertThat(response.generatedAt()).isEqualTo(Instant.parse("2026-09-22T04:00:00Z"));
        assertThat(response.lastCompletedAt()).isEqualTo(completedAt);
        assertThat(response.status()).isEqualTo(NoticeFreshnessStatus.FRESH);
        ArgumentCaptor<List<SyncExecutionStatus>> statuses = ArgumentCaptor.forClass(List.class);
        verify(executionRepository).findFirstByStatusInOrderByFinishedAtDesc(statuses.capture());
        assertThat(statuses.getValue()).containsExactly(SyncExecutionStatus.SUCCEEDED, SyncExecutionStatus.PARTIALLY_SUCCEEDED);
    }

    @Test
    void returnsNullWhenNoSynchronizationHasCompleted() {
        when(executionRepository.findFirstByStatusInOrderByFinishedAtDesc(List.of(
                SyncExecutionStatus.SUCCEEDED,
                SyncExecutionStatus.PARTIALLY_SUCCEEDED
        ))).thenReturn(Optional.empty());

        NoticeFreshnessService service = new NoticeFreshnessService(executionRepository,
                Clock.fixed(Instant.parse("2026-09-22T04:00:00Z"), ZoneOffset.UTC));

        var response = service.freshness();
        assertThat(response.lastCompletedAt()).isNull();
        assertThat(response.status()).isEqualTo(NoticeFreshnessStatus.UNAVAILABLE);
    }

    @Test
    void marksDataAsDelayedAfterThirtyHoursWithoutACompletedSynchronization() {
        Instant completedAt = Instant.parse("2026-09-20T00:00:00Z");
        SyncExecution execution = SyncExecution.start(completedAt.minusSeconds(20));
        execution.succeed(completedAt, 20, 20);
        when(executionRepository.findFirstByStatusInOrderByFinishedAtDesc(List.of(
                SyncExecutionStatus.SUCCEEDED,
                SyncExecutionStatus.PARTIALLY_SUCCEEDED
        ))).thenReturn(Optional.of(execution));

        NoticeFreshnessService service = new NoticeFreshnessService(executionRepository,
                Clock.fixed(Instant.parse("2026-09-21T06:01:00Z"), ZoneOffset.UTC));

        assertThat(service.freshness().status()).isEqualTo(NoticeFreshnessStatus.DELAYED);
    }
}
