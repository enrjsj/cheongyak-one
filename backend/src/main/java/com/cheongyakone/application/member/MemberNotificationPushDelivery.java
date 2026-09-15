package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;

@Service
public class MemberNotificationPushDelivery {

    private static final int MAXIMUM_ATTEMPTS = 5;
    private final MemberNotificationRepository notificationRepository;
    private final MemberDeviceTokenRepository deviceTokenRepository;
    private final MemberPushSender pushSender;
    private final Clock clock;

    public MemberNotificationPushDelivery(
            MemberNotificationRepository notificationRepository,
            MemberDeviceTokenRepository deviceTokenRepository,
            MemberPushSender pushSender,
            Clock clock
    ) {
        this.notificationRepository = notificationRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.pushSender = pushSender;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean deliver(Long notificationId) {
        var now = clock.instant();
        var notification = notificationRepository.findForPushDelivery(notificationId).orElse(null);
        if (notification == null || !notification.isPushDeliveryDue(now, MAXIMUM_ATTEMPTS)) return false;

        var tokens = deviceTokenRepository.findAllByMember_IdOrderByUpdatedAtDesc(notification.getMemberId()).stream()
                .map(token -> token.getPushToken())
                .toList();
        if (tokens.isEmpty()) {
            notification.markPushSent(now);
            return true;
        }
        var result = pushSender.send(notification, tokens);
        if (!result.invalidTokens().isEmpty()) {
            deviceTokenRepository.deleteByPushTokenIn(result.invalidTokens());
        }
        if (result.retryableFailure()) {
            int nextAttempt = notification.getPushAttempts() + 1;
            notification.markPushFailed(result.error(), now.plus(retryDelay(nextAttempt)));
            return false;
        }
        notification.markPushSent(now);
        return true;
    }

    private Duration retryDelay(int attempt) {
        return Duration.ofMinutes(1L << Math.min(Math.max(attempt - 1, 0), 4));
    }
}
