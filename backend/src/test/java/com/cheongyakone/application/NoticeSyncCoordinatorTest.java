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
        List<Runnable> queuedTasks = new ArrayList<>();
        TaskExecutor executor = queuedTasks::add;
        NoticeSyncCoordinator coordinator = new NoticeSyncCoordinator(syncService, executor);

        assertThat(coordinator.requestAsync()).isTrue();
        assertThat(coordinator.requestAsync()).isFalse();
        assertThat(queuedTasks).hasSize(1);

        queuedTasks.getFirst().run();

        verify(syncService).synchronize();
        assertThat(coordinator.requestAsync()).isTrue();
        assertThat(queuedTasks).hasSize(2);
    }
}
