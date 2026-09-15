package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.AdminPushNotificationResponse;
import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

@Service
public class AdminPushNotificationService {
    private static final int MAXIMUM_ATTEMPTS = 5;
    private final MemberService memberService;
    private final MemberDeviceTokenRepository deviceTokenRepository;
    private final MemberNotificationRepository notificationRepository;
    private final Clock clock;

    public AdminPushNotificationService(MemberService memberService, MemberDeviceTokenRepository deviceTokenRepository,
                                        MemberNotificationRepository notificationRepository, Clock clock) {
        this.memberService = memberService;
        this.deviceTokenRepository = deviceTokenRepository;
        this.notificationRepository = notificationRepository;
        this.clock = clock;
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
}
