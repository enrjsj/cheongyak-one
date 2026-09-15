package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.AdminPushNotificationResponse;
import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.application.member.MemberNotificationPushDispatcher;
import com.cheongyakone.application.member.MemberApiException;
import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;

import java.time.Clock;

@Service
public class AdminPushNotificationService {
    private static final int MAXIMUM_ATTEMPTS = 5;
    private final MemberService memberService;
    private final MemberDeviceTokenRepository deviceTokenRepository;
    private final MemberNotificationRepository notificationRepository;
    private final Clock clock;
    private final MemberNotificationPushDispatcher pushDispatcher;

    public AdminPushNotificationService(MemberService memberService, MemberDeviceTokenRepository deviceTokenRepository,
                                        MemberNotificationRepository notificationRepository, Clock clock,
                                        MemberNotificationPushDispatcher pushDispatcher) {
        this.memberService = memberService;
        this.deviceTokenRepository = deviceTokenRepository;
        this.notificationRepository = notificationRepository;
        this.clock = clock;
        this.pushDispatcher = pushDispatcher;
    }

    @Transactional(readOnly = true)
    public AdminPushNotificationResponse dashboard(String rawToken) {
        memberService.requireAdmin(rawToken);
        var now = clock.instant();
        return new AdminPushNotificationResponse(
                deviceTokenRepository.count(),
                notificationRepository.countPendingPushDeliveries(MAXIMUM_ATTEMPTS),
                notificationRepository.countFailedPushDeliveries(MAXIMUM_ATTEMPTS),
                notificationRepository.countByPushSentAtAfter(now.minus(java.time.Duration.ofHours(24))),
                notificationRepository.findRecentFailedPushDeliveries(MAXIMUM_ATTEMPTS, PageRequest.of(0, 10)).stream()
                        .map(AdminPushNotificationResponse.Failure::from).toList(),
                now
        );
    }

    @Transactional
    public void retryFailed(String rawToken, Long notificationId) {
        memberService.requireAdmin(rawToken);
        var notification = notificationRepository.findForPushDelivery(notificationId)
                .orElseThrow(() -> new MemberApiException(HttpStatus.NOT_FOUND, "PUSH_NOTIFICATION_NOT_FOUND", "푸시 발송 이력을 찾을 수 없습니다."));
        if (!notification.retryFailedPush(clock.instant(), MAXIMUM_ATTEMPTS)) {
            throw new MemberApiException(HttpStatus.CONFLICT, "PUSH_NOTIFICATION_NOT_RETRYABLE", "최종 실패한 푸시만 재시도할 수 있습니다.");
        }
    }

    @Transactional(readOnly = true)
    public int dispatchPending(String rawToken) {
        memberService.requireAdmin(rawToken);
        return pushDispatcher.deliverPendingPushes();
    }
}
