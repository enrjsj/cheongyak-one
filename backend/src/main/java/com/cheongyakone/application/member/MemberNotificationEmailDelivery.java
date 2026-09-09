package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import com.cheongyakone.domain.member.NotificationType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@Service
public class MemberNotificationEmailDelivery {

    private static final Logger log = LoggerFactory.getLogger(MemberNotificationEmailDelivery.class);
    private static final int MAXIMUM_ATTEMPTS = 5;

    private final MemberNotificationRepository notificationRepository;
    private final MemberMailSender mailSender;
    private final Clock clock;

    public MemberNotificationEmailDelivery(
            MemberNotificationRepository notificationRepository,
            MemberMailSender mailSender,
            Clock clock
    ) {
        this.notificationRepository = notificationRepository;
        this.mailSender = mailSender;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean deliver(Long notificationId) {
        Instant now = clock.instant();
        MemberNotification notification = notificationRepository.findForEmailDelivery(notificationId)
                .orElse(null);
        if (notification == null || !notification.isEmailDeliveryDue(now, MAXIMUM_ATTEMPTS)) {
            return false;
        }
        try {
            mailSender.sendNoticeNotification(
                    notification.getMemberEmail(),
                    notification.getNoticeTitle(),
                    notificationLabel(notification.getType()),
                    notification.getType().message(),
                    notification.getEventDate().toString(),
                    notification.getNoticeOfficialUrl()
            );
            notification.markEmailSent(now);
            return true;
        } catch (RuntimeException exception) {
            int nextAttempt = notification.getEmailAttempts() + 1;
            notification.markEmailFailed(
                    exception.getClass().getSimpleName() + ": " + exception.getMessage(),
                    now.plus(retryDelay(nextAttempt))
            );
            log.warn(
                    "Member notification email delivery failed: notificationId={}, attempt={}",
                    notificationId,
                    nextAttempt
            );
            return false;
        }
    }

    private String notificationLabel(NotificationType type) {
        return switch (type) {
            case NEW_MATCHING_NOTICE -> "신규 공고";
            case NOTICE_UPDATED -> "공고 변경";
            default -> "일정";
        };
    }

    private Duration retryDelay(int attempt) {
        return Duration.ofMinutes(1L << Math.min(Math.max(attempt - 1, 0), 4));
    }
}
