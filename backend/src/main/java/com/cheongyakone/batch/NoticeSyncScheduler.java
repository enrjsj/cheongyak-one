package com.cheongyakone.batch;

import com.cheongyakone.application.NoticeSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NoticeSyncScheduler {

    private static final Logger log = LoggerFactory.getLogger(NoticeSyncScheduler.class);

    private final NoticeSyncService noticeSyncService;

    public NoticeSyncScheduler(NoticeSyncService noticeSyncService) {
        this.noticeSyncService = noticeSyncService;
    }

    @Scheduled(cron = "${app.notice-sync.cron}", zone = "${app.notice-sync.zone}")
    public void synchronizeNotices() {
        log.info("Daily subscription notice synchronization started");
        noticeSyncService.synchronize();
        log.info("Daily subscription notice synchronization completed");
    }
}
