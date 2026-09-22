package com.cheongyakone.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class NoticeSyncCoordinator {

    private static final Logger log = LoggerFactory.getLogger(NoticeSyncCoordinator.class);

    private final NoticeSyncService noticeSyncService;
    private final TaskExecutor noticeSyncExecutor;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public NoticeSyncCoordinator(
            NoticeSyncService noticeSyncService,
            @Qualifier("noticeSyncExecutor") TaskExecutor noticeSyncExecutor
    ) {
        this.noticeSyncService = noticeSyncService;
        this.noticeSyncExecutor = noticeSyncExecutor;
    }

    public boolean requestAsync() {
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        try {
            noticeSyncExecutor.execute(() -> {
                try {
                    noticeSyncService.synchronize();
                } catch (RuntimeException exception) {
                    // 실행 결과와 오류 사유는 기존 SYNC_EXECUTION 이력에 기록한다.
                    log.error("Manually requested notice synchronization failed", exception);
                } finally {
                    running.set(false);
                }
            });
            return true;
        } catch (RuntimeException exception) {
            running.set(false);
            throw exception;
        }
    }

    public boolean synchronizeScheduled() {
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        try {
            noticeSyncService.synchronize();
            return true;
        } finally {
            running.set(false);
        }
    }

    /**
     * GitHub Actions 같은 외부 스케줄러가 호출할 때 사용한다. 실행 중인 동기화가 있으면
     * false를 반환해 중복 수집을 피한다.
     */
    public boolean synchronizeExternallyTriggered() {
        return synchronizeScheduled();
    }
}
