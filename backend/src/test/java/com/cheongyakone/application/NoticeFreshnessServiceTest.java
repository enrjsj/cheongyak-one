package com.cheongyakone.application;

import com.cheongyakone.api.NoticeFreshnessStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.sync.*;
import com.cheongyakone.infrastructure.external.NoticeSourceClient;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class NoticeFreshnessServiceTest {
    private final Instant now = Instant.parse("2026-10-06T00:00:00Z");
    private final SourceSyncExecutionRepository repository = mock(SourceSyncExecutionRepository.class);
    private final Map<SourceSystem, SourceSyncExecution> latest = new EnumMap<>(SourceSystem.class);
    private final Map<SourceSystem, SourceSyncExecution> successes = new EnumMap<>(SourceSystem.class);

    private NoticeFreshnessService service(SourceSystem... enabled) {
        when(repository.findFirstBySourceSystemOrderByStartedAtDescIdDesc(any())).thenAnswer(call -> Optional.ofNullable(latest.get(call.getArgument(0))));
        when(repository.findFirstBySourceSystemAndStatusOrderByFinishedAtDescIdDesc(any(), eq(SourceSyncStatus.SUCCEEDED)))
                .thenAnswer(call -> Optional.ofNullable(successes.get(call.getArgument(0))));
        var clients = Arrays.stream(enabled).map(source -> {
            NoticeSourceClient client = mock(NoticeSourceClient.class);
            when(client.sourceSystem()).thenReturn(source); when(client.enabled()).thenReturn(true); return client;
        }).toList();
        return new NoticeFreshnessService(repository, clients, Clock.fixed(now, ZoneOffset.UTC));
    }
    private void success(SourceSystem source, Instant at) {
        var row = SourceSyncExecution.start(1L, source, at.minusSeconds(10));
        row.complete(at, 3, 3, 0, 0, 0, false); latest.put(source, row); successes.put(source, row);
    }
    @Test void partialSuccessNeverMakesFailedSourceFreshOrAdvancesItsSuccessTime() {
        success(SourceSystem.REB_APT, now.minusSeconds(200000));
        success(SourceSystem.REB_OFFICETEL, now);
        var failed = SourceSyncExecution.start(2L, SourceSystem.REB_APT, now.minusSeconds(10));
        failed.complete(now, 3, 3, 0, 1, 0, false); latest.put(SourceSystem.REB_APT, failed);
        var response = service(SourceSystem.REB_APT, SourceSystem.REB_OFFICETEL).freshness();
        assertThat(response.status()).isEqualTo(NoticeFreshnessStatus.DELAYED);
        assertThat(response.lastCompletedAt()).isEqualTo(now.minusSeconds(200000));
        var apt = response.sources().getFirst();
        assertThat(apt.lastSuccessfulAt()).isEqualTo(now.minusSeconds(200000));
        assertThat(apt.failedUnitTypeCount()).isEqualTo(1);
        assertThat(apt.retryRecommended()).isTrue();
        assertThat(response.sources().get(1).status()).isEqualTo(NoticeFreshnessStatus.FRESH);
    }
    @Test void disabledSourcesDoNotDelayConfiguredSourcesAndThirtyHourBoundaryIsInclusive() {
        success(SourceSystem.REB_APT, now.minus(Duration.ofHours(30)));
        var service = service(SourceSystem.REB_APT);
        assertThat(service.freshness().status()).isEqualTo(NoticeFreshnessStatus.FRESH);
        assertThat(service.freshness().sources().get(2).configured()).isFalse();
        assertThat(service.freshness().sources().get(2).retryRecommended()).isFalse();
        success(SourceSystem.REB_APT, now.minus(Duration.ofHours(30)).minusSeconds(1));
        assertThat(service.freshness().status()).isEqualTo(NoticeFreshnessStatus.DELAYED);
    }
    @Test void noSourceHistoryIsUnknownAndOneMissingSourceCannotBorrowAnotherSourcesSuccess() {
        var service = service(SourceSystem.REB_APT, SourceSystem.REB_OFFICETEL);
        assertThat(service.freshness().status()).isEqualTo(NoticeFreshnessStatus.UNAVAILABLE);
        success(SourceSystem.REB_APT, now);
        assertThat(service.freshness().status()).isEqualTo(NoticeFreshnessStatus.DELAYED);
        assertThat(service.freshness().lastCompletedAt()).isNull();
        assertThat(service.freshness().sources().get(1).lastSuccessfulAt()).isNull();
    }
    @Test void recentFailureIsVisibleEvenWithRecentSuccessAndRunningSourceCannotBeRetried() {
        success(SourceSystem.REB_APT, now.minusSeconds(60));
        var failure = SourceSyncExecution.start(2L, SourceSystem.REB_APT, now);
        failure.fail(now, 0, 0); latest.put(SourceSystem.REB_APT, failure);
        var service = service(SourceSystem.REB_APT);
        assertThat(service.freshness().status()).isEqualTo(NoticeFreshnessStatus.DELAYED);
        latest.put(SourceSystem.REB_APT, SourceSyncExecution.start(3L, SourceSystem.REB_APT, now));
        assertThat(service.freshness().sources().getFirst().retryRecommended()).isFalse();
    }
}
