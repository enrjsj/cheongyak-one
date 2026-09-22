package com.cheongyakone.application;

import com.cheongyakone.application.member.MemberNotificationGenerator;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;

@Service
public class ScheduledNoticeSyncService {

    private final NoticeSyncCoordinator noticeSyncCoordinator;
    private final MemberNotificationGenerator notificationGenerator;
    private final Clock clock;

    public ScheduledNoticeSyncService(
            NoticeSyncCoordinator noticeSyncCoordinator,
            MemberNotificationGenerator notificationGenerator,
            Clock clock
    ) {
        this.noticeSyncCoordinator = noticeSyncCoordinator;
        this.notificationGenerator = notificationGenerator;
        this.clock = clock;
    }

    public ScheduledNoticeSyncResult synchronize() {
        if (!noticeSyncCoordinator.synchronizeExternallyTriggered()) {
            return ScheduledNoticeSyncResult.alreadyRunning();
        }

        LocalDate today = LocalDate.now(clock);
        int notificationsCreated = notificationGenerator.generateFor(today)
                + notificationGenerator.generateMatchingFor(today)
                + notificationGenerator.generateUpdatedFor(today);
        return ScheduledNoticeSyncResult.completed(notificationsCreated);
    }

    public record ScheduledNoticeSyncResult(boolean started, int notificationsCreated) {
        static ScheduledNoticeSyncResult completed(int notificationsCreated) {
            return new ScheduledNoticeSyncResult(true, notificationsCreated);
        }

        static ScheduledNoticeSyncResult alreadyRunning() {
            return new ScheduledNoticeSyncResult(false, 0);
        }
    }
}
