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
    private final MemberPushReceiptStore receipts;

    public MemberNotificationPushDelivery(
            MemberNotificationRepository notificationRepository,
            MemberDeviceTokenRepository deviceTokenRepository,
            MemberPushSender pushSender,
            Clock clock,
            MemberPushReceiptStore receipts
    ) {
        this.notificationRepository = notificationRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.pushSender = pushSender;
        this.clock = clock;
        this.receipts = receipts;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean deliver(Long notificationId) {
        // Disabled transport must not turn queued notifications into false delivery successes.
        if (!pushSender.enabled()) return false;
        var now = clock.instant();
        var notification = notificationRepository.findForPushDelivery(notificationId).orElse(null);
        if (notification == null || !notification.isPushDeliveryDue(now, MAXIMUM_ATTEMPTS)) return false;

        var completed = receipts.completed(notificationId);
        var tokens = deviceTokenRepository.findAllByMember_IdOrderByUpdatedAtDesc(notification.memberId()).stream()
                .map(token -> token.getPushToken())
                .filter(token -> !completed.contains(MemberPushReceiptStore.hash(token)))
                .distinct()
                .toList();
        if (tokens.isEmpty()) {
            var reason = receipts.completionReason(notificationId);
            notification.markPushCompleted(now, reason);
            return reason == com.cheongyakone.domain.member.MemberNotification.PushCompletionReason.ACCEPTED;
        }
        var result = pushSender.send(notification, tokens);
        var successful = result.successfulTokens().stream().filter(tokens::contains).toList();
        var invalid = result.invalidTokens().stream().filter(tokens::contains).toList();
        receipts.recordAccepted(notificationId, successful, now);
        receipts.recordInvalid(notificationId, invalid, now);
        if (!invalid.isEmpty()) {
            deviceTokenRepository.deleteByPushTokenIn(invalid);
        }
        boolean unconfirmed = tokens.stream().anyMatch(token -> !successful.contains(token) && !invalid.contains(token));
        if (result.retryableFailure() || unconfirmed) {
            int nextAttempt = notification.getPushAttempts() + 1;
            notification.markPushFailed(unconfirmed ? "FCM delivery not confirmed" : result.error(), now.plus(retryDelay(nextAttempt)));
            return false;
        }
        var reason = receipts.completionReason(notificationId);
        notification.markPushCompleted(now, reason);
        return reason == com.cheongyakone.domain.member.MemberNotification.PushCompletionReason.ACCEPTED;
    }

    private Duration retryDelay(int attempt) {
        return Duration.ofMinutes(1L << Math.min(Math.max(attempt - 1, 0), 4));
    }
}

