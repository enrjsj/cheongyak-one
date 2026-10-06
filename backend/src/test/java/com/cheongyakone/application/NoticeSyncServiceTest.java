package com.cheongyakone.application;

import com.cheongyakone.config.NoticeSyncRetryProperties;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.infrastructure.external.NoticeSourceClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NoticeSyncServiceTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-09-09T00:00:00Z"), ZoneOffset.UTC);
    private final NoticeUpsertService upsertService = mock(NoticeUpsertService.class);
    private final SyncExecutionRecorder recorder = mock(SyncExecutionRecorder.class);
    private final NoticeSyncRetryWaiter retryWaiter = mock(NoticeSyncRetryWaiter.class);
    private final RebApartmentUnitTypeSyncService apartmentUnitTypeSyncService = mock(RebApartmentUnitTypeSyncService.class);
    private final RebOfficetelUnitTypeSyncService officetelUnitTypeSyncService = mock(RebOfficetelUnitTypeSyncService.class);
    private final SyncExecution execution = SyncExecution.start(clock.instant());

    @BeforeEach
    void prepareExecution() {
        when(recorder.start(clock.instant())).thenReturn(execution);
        when(recorder.startSource(any(), any(), any())).thenAnswer(call ->
                com.cheongyakone.domain.sync.SourceSyncExecution.start(1L, call.getArgument(1), clock.instant()));
        when(apartmentUnitTypeSyncService.synchronize(any(), any())).thenReturn(new UnitTypeSyncResult(1, 1, 1, 0, false, 0));
        when(officetelUnitTypeSyncService.synchronize(any(), any())).thenReturn(new UnitTypeSyncResult(1, 1, 1, 0, false, 0));
    }

    @Test
    void retriesTransientFailureAndCompletesSuccessfully() {
        NoticeSourceClient client = source(SourceSystem.REB_APT, true);
        NoticeSnapshot snapshot = snapshot(SourceSystem.REB_APT, "apt-1");
        when(client.fetch(any(), any()))
                .thenThrow(new IllegalStateException("temporary failure"))
                .thenReturn(List.of(snapshot));

        NoticeSyncResult result = service(List.of(client), 3).synchronize();

        assertThat(result.fetchedCount()).isEqualTo(1);
        assertThat(result.savedCount()).isEqualTo(1);
        verify(client, times(2)).fetch(any(), any());
        verify(retryWaiter).pause(Duration.ZERO);
        verify(upsertService).upsert(snapshot, clock.instant());
        verify(recorder).succeed(execution, clock.instant(), 1, 1);
    }

    @Test
    void recordsPartialSuccessAndContinuesWithHealthySources() {
        NoticeSourceClient failed = source(SourceSystem.REB_APT, true);
        NoticeSourceClient healthy = source(SourceSystem.MYHOME_PUBLIC_RENTAL, true);
        NoticeSourceClient disabled = source(SourceSystem.REB_OFFICETEL, false);
        NoticeSnapshot snapshot = snapshot(SourceSystem.MYHOME_PUBLIC_RENTAL, "rental-1");
        when(failed.fetch(any(), any())).thenThrow(new IllegalStateException("upstream unavailable"));
        when(healthy.fetch(any(), any())).thenReturn(List.of(snapshot));

        NoticeSyncResult result = service(List.of(failed, healthy, disabled), 2).synchronize();

        assertThat(result.savedCount()).isEqualTo(1);
        verify(failed, times(2)).fetch(any(), any());
        verify(healthy).fetch(any(), any());
        verify(disabled, never()).fetch(any(), any());
        verify(recorder).partiallySucceed(
                eq(execution),
                eq(clock.instant()),
                eq(1),
                eq(1),
                contains("REB_APT: upstream unavailable")
        );
        verify(recorder, never()).fail(any(), any(), anyInt(), anyInt(), any());
    }

    @Test
    void synchronizesOfficetelUnitTypesAfterSavingOfficetelNotices() {
        NoticeSourceClient client = source(SourceSystem.REB_OFFICETEL, true);
        NoticeSnapshot snapshot = snapshot(SourceSystem.REB_OFFICETEL, "office-1");
        when(client.fetch(any(), any())).thenReturn(List.of(snapshot));

        service(List.of(client), 1).synchronize();

        verify(officetelUnitTypeSyncService).synchronize(List.of("office-1"), clock.instant());
        verify(apartmentUnitTypeSyncService, never()).synchronize(any(), any());
    }

    @Test
    void failsExecutionWhenEveryEnabledSourceFails() {
        NoticeSourceClient failed = source(SourceSystem.REB_APT, true);
        when(failed.fetch(any(), any())).thenThrow(new IllegalStateException("serviceKey=secret-value&code=500"));

        assertThatThrownBy(() -> service(List.of(failed), 2).synchronize())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("REB_APT");

        ArgumentCaptor<RuntimeException> failure = ArgumentCaptor.forClass(RuntimeException.class);
        verify(recorder).fail(any(), any(), anyInt(), anyInt(), failure.capture());
        assertThat(failure.getValue().getMessage())
                .contains("serviceKey=***")
                .doesNotContain("secret-value");
        verify(failed, times(2)).fetch(any(), any());
    }

    @Test
    void failsClearlyWhenNoSourceIsConfigured() {
        NoticeSourceClient disabled = source(SourceSystem.MYHOME_PUBLIC_RENTAL, false);

        assertThatThrownBy(() -> service(List.of(disabled), 2).synchronize())
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("No notice source is configured");

        verify(disabled, never()).fetch(any(), any());
        verify(recorder).fail(any(), any(), eq(0), eq(0), any(IllegalStateException.class));
    }

    @Test
    void recordsFailedSavesUnitFailuresAndEmptyResponsesWithoutStoppingOtherSources() {
        var apt = source(SourceSystem.REB_APT, true);
        var rental = source(SourceSystem.MYHOME_PUBLIC_RENTAL, true);
        var broken = snapshot(SourceSystem.REB_APT, "broken");
        var good = snapshot(SourceSystem.REB_APT, "good");
        when(apt.fetch(any(), any())).thenReturn(List.of(broken, good));
        when(rental.fetch(any(), any())).thenReturn(List.of(snapshot(SourceSystem.MYHOME_PUBLIC_RENTAL, "rental")));
        org.mockito.Mockito.doThrow(new IllegalStateException("save failure")).when(upsertService).upsert(eq(broken), any());
        when(apartmentUnitTypeSyncService.synchronize(any(), any())).thenReturn(new UnitTypeSyncResult(1, 0, 0, 1, false, 0));
        var result = service(List.of(apt, rental), 1).synchronize();
        assertThat(result.fetchedCount()).isEqualTo(3);
        assertThat(result.savedCount()).isEqualTo(2);
        var rows = ArgumentCaptor.forClass(com.cheongyakone.domain.sync.SourceSyncExecution.class);
        verify(recorder, times(2)).saveSource(rows.capture());
        assertThat(rows.getAllValues().getFirst().getFailedNoticeCount()).isEqualTo(1);
        assertThat(rows.getAllValues().getFirst().getFailedUnitTypeCount()).isEqualTo(1);
        assertThat(rows.getAllValues().getFirst().getStatus()).isEqualTo(com.cheongyakone.domain.sync.SourceSyncStatus.PARTIALLY_SUCCEEDED);
        assertThat(rows.getAllValues().get(1).getStatus()).isEqualTo(com.cheongyakone.domain.sync.SourceSyncStatus.SUCCEEDED);
        verify(apartmentUnitTypeSyncService).synchronize(List.of("good"), clock.instant());
    }

    @Test
    void targetedRetryDoesNotFetchOrRecordOtherSourcesAndEmptyPayloadIsNotAFailure() {
        var apt = source(SourceSystem.REB_APT, true);
        var office = source(SourceSystem.REB_OFFICETEL, true);
        when(apt.fetch(any(), any())).thenReturn(List.of(snapshot(SourceSystem.REB_APT, "empty-units")));
        when(apartmentUnitTypeSyncService.synchronize(any(), any())).thenReturn(new UnitTypeSyncResult(1, 1, 0, 0, false, 1));
        service(List.of(apt, office), 1).synchronize(SourceSystem.REB_APT);
        verify(office, never()).fetch(any(), any());
        verify(recorder, never()).startSource(any(), eq(SourceSystem.REB_OFFICETEL), any());
        var rows = ArgumentCaptor.forClass(com.cheongyakone.domain.sync.SourceSyncExecution.class);
        verify(recorder).saveSource(rows.capture());
        assertThat(rows.getValue().getEmptyUnitTypeCount()).isEqualTo(1);
        assertThat(rows.getValue().getStatus()).isEqualTo(com.cheongyakone.domain.sync.SourceSyncStatus.SUCCEEDED);
    }

    private NoticeSyncService service(List<NoticeSourceClient> clients, int maxAttempts) {
        return new NoticeSyncService(
                clients,
                upsertService,
                recorder,
                new NoticeSyncRetryProperties(maxAttempts, Duration.ZERO),
                retryWaiter,
                apartmentUnitTypeSyncService,
                officetelUnitTypeSyncService,
                clock
        );
    }

    private NoticeSourceClient source(SourceSystem sourceSystem, boolean enabled) {
        NoticeSourceClient client = mock(NoticeSourceClient.class);
        when(client.sourceSystem()).thenReturn(sourceSystem);
        when(client.enabled()).thenReturn(enabled);
        return client;
    }

    private NoticeSnapshot snapshot(SourceSystem sourceSystem, String sourceNoticeId) {
        return new NoticeSnapshot(
                sourceSystem,
                sourceNoticeId,
                sourceSystem == SourceSystem.MYHOME_PUBLIC_RENTAL
                        ? HousingCategory.PUBLIC_RENTAL
                        : HousingCategory.APARTMENT,
                NoticeStatus.OPEN,
                "테스트 공고",
                "서울",
                "서울특별시",
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 9),
                LocalDate.of(2026, 9, 10),
                null,
                10,
                null,
                null,
                "https://example.test/notices/1",
                "hash"
        );
    }
}
