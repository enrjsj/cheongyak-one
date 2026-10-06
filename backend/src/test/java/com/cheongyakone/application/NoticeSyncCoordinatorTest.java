package com.cheongyakone.application;

import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskExecutor;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class NoticeSyncCoordinatorTest {

    @Test
    void acceptsOnlyOneManualSynchronizationUntilQueuedWorkFinishes() {
        NoticeSyncService syncService = mock(NoticeSyncService.class);
        com.cheongyakone.domain.notice.SubscriptionNoticeRepository noticeRepository = mock(com.cheongyakone.domain.notice.SubscriptionNoticeRepository.class);
        RebApartmentUnitTypeSyncService apartmentUnitTypeSyncService = mock(RebApartmentUnitTypeSyncService.class);
        RebOfficetelUnitTypeSyncService officetelUnitTypeSyncService = mock(RebOfficetelUnitTypeSyncService.class);
        List<Runnable> queuedTasks = new ArrayList<>();
        TaskExecutor executor = queuedTasks::add;
        NoticeSyncCoordinator coordinator = new NoticeSyncCoordinator(
                syncService,
                noticeRepository,
                apartmentUnitTypeSyncService,
                officetelUnitTypeSyncService,
                executor
        );

        assertThat(coordinator.requestAsync()).isTrue();
        assertThat(coordinator.requestAsync()).isFalse();
        assertThat(queuedTasks).hasSize(1);

        queuedTasks.getFirst().run();

        verify(syncService).synchronize();
        assertThat(coordinator.requestAsync()).isTrue();
        assertThat(queuedTasks).hasSize(2);
        assertThat(coordinator.requestAsync(com.cheongyakone.domain.notice.SourceSystem.REB_APT)).isFalse();
        queuedTasks.get(1).run();
        assertThat(coordinator.requestAsync(com.cheongyakone.domain.notice.SourceSystem.REB_APT)).isTrue();
        queuedTasks.get(2).run();
        verify(syncService).synchronize(com.cheongyakone.domain.notice.SourceSystem.REB_APT);
    }
}
