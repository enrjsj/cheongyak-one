package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;

@Service
public class MemberNotificationEmailDispatcher {

    private static final Logger log = LoggerFactory.getLogger(MemberNotificationEmailDispatcher.class);
    private static final int BATCH_SIZE = 50;
    private static final int MAXIMUM_ATTEMPTS = 5;

    private final MemberNotificationRepository notificationRepository;
    private final MemberNotificationEmailDelivery emailDelivery;
    private final Clock clock;

    public MemberNotificationEmailDispatcher(
            MemberNotificationRepository notificationRepository,
            MemberNotificationEmailDelivery emailDelivery,
            Clock clock
    ) {
        this.notificationRepository = notificationRepository;
        this.emailDelivery = emailDelivery;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.member-notification.email-cron}", zone = "${app.member-notification.zone}")
    public void deliverScheduledEmails() {
        deliverPendingEmails();
    }

    public int deliverPendingEmails() {
        var candidateIds = notificationRepository.findEmailDeliveryCandidateIds(
                clock.instant(),
                MAXIMUM_ATTEMPTS,
                PageRequest.of(0, BATCH_SIZE)
        );
        int sentCount = 0;
        for (Long notificationId : candidateIds) {
            if (emailDelivery.deliver(notificationId)) {
                sentCount += 1;
            }
        }
        if (!candidateIds.isEmpty()) {
            log.info("Member notification email delivery completed: candidates={}, sent={}",
                    candidateIds.size(), sentCount);
        }
        return sentCount;
    }
}
