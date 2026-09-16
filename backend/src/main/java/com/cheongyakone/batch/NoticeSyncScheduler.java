package com.cheongyakone.batch;

// 설정된 주기로 공고 동기화를 요청하고, 세부 처리 규칙은 애플리케이션 계층에 위임한다.

import com.cheongyakone.application.NoticeSyncCoordinator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NoticeSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(NoticeSyncScheduler.class);

    private final NoticeSyncCoordinator noticeSyncCoordinator;

    public NoticeSyncScheduler(NoticeSyncCoordinator noticeSyncCoordinator) {
        this.noticeSyncCoordinator = noticeSyncCoordinator;
    }

    @Scheduled(cron = "${app.notice-sync.cron}", zone = "${app.notice-sync.zone}")
    public void synchronizeNotices() {
        if (!noticeSyncCoordinator.synchronizeScheduled()) {
            log.info("Daily subscription notice synchronization skipped because another run is active");
            return;
        }
        log.info("Daily subscription notice synchronization completed");
    }
}
