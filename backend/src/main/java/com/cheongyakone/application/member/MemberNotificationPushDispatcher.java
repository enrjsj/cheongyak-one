package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;

@Service
public class MemberNotificationPushDispatcher {

    private static final int BATCH_SIZE = 50;
    private static final int MAXIMUM_ATTEMPTS = 5;
    private final MemberNotificationRepository notificationRepository;
    private final MemberNotificationPushDelivery pushDelivery;
    private final Clock clock;

    public MemberNotificationPushDispatcher(
            MemberNotificationRepository notificationRepository,
            MemberNotificationPushDelivery pushDelivery,
            Clock clock
    ) {
        this.notificationRepository = notificationRepository;
        this.pushDelivery = pushDelivery;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.member-notification.push-cron:0 */5 * * * *}", zone = "${app.member-notification.zone}")
    public void deliverScheduledPushes() {
        deliverPendingPushes();
    }

    public int deliverPendingPushes() {
        var candidateIds = notificationRepository.findPushDeliveryCandidateIds(
                clock.instant(), MAXIMUM_ATTEMPTS, PageRequest.of(0, BATCH_SIZE)
        );
        int sentCount = 0;
        for (Long notificationId : candidateIds) {
            if (pushDelivery.deliver(notificationId)) sentCount += 1;
        }
        return sentCount;
    }
}
