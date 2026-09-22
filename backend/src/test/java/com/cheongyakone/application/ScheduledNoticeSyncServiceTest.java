package com.cheongyakone.application;

import com.cheongyakone.application.member.MemberNotificationGenerator;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ScheduledNoticeSyncServiceTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-09-22T00:00:00Z"), ZoneId.of("Asia/Seoul"));

    @Test
    void synchronizesAndGeneratesEveryNotificationType() {
        NoticeSyncCoordinator coordinator = mock(NoticeSyncCoordinator.class);
        MemberNotificationGenerator generator = mock(MemberNotificationGenerator.class);
        LocalDate today = LocalDate.now(clock);
        when(coordinator.synchronizeExternallyTriggered()).thenReturn(true);
        when(generator.generateFor(today)).thenReturn(2);
        when(generator.generateMatchingFor(today)).thenReturn(3);
        when(generator.generateUpdatedFor(today)).thenReturn(1);

        ScheduledNoticeSyncService service = new ScheduledNoticeSyncService(coordinator, generator, clock);

        ScheduledNoticeSyncService.ScheduledNoticeSyncResult result = service.synchronize();

        assertThat(result.started()).isTrue();
        assertThat(result.notificationsCreated()).isEqualTo(6);
        verify(generator).generateFor(today);
        verify(generator).generateMatchingFor(today);
        verify(generator).generateUpdatedFor(today);
    }

    @Test
    void skipsNotificationGenerationWhenAnotherSyncIsRunning() {
        NoticeSyncCoordinator coordinator = mock(NoticeSyncCoordinator.class);
        MemberNotificationGenerator generator = mock(MemberNotificationGenerator.class);
        when(coordinator.synchronizeExternallyTriggered()).thenReturn(false);

        ScheduledNoticeSyncService service = new ScheduledNoticeSyncService(coordinator, generator, clock);

        ScheduledNoticeSyncService.ScheduledNoticeSyncResult result = service.synchronize();

        assertThat(result.started()).isFalse();
        assertThat(result.notificationsCreated()).isZero();
        verifyNoInteractions(generator);
    }
}
