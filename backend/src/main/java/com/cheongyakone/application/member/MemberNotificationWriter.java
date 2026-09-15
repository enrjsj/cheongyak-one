package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import com.cheongyakone.domain.member.MemberNotificationPreferenceRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import com.cheongyakone.domain.member.MemberRepository;
import com.cheongyakone.domain.member.NotificationType;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;

@Service
public class MemberNotificationWriter {

    private final MemberNotificationRepository notificationRepository;
    private final MemberRepository memberRepository;
    private final SubscriptionNoticeRepository noticeRepository;
    private final MemberNotificationPreferenceRepository preferenceRepository;
    private final MemberDeviceTokenRepository deviceTokenRepository;
    private final MemberPushSender pushSender;

    public MemberNotificationWriter(
            MemberNotificationRepository notificationRepository,
            MemberRepository memberRepository,
            SubscriptionNoticeRepository noticeRepository,
            MemberNotificationPreferenceRepository preferenceRepository,
            MemberDeviceTokenRepository deviceTokenRepository,
            MemberPushSender pushSender
    ) {
        this.notificationRepository = notificationRepository;
        this.memberRepository = memberRepository;
        this.noticeRepository = noticeRepository;
        this.preferenceRepository = preferenceRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.pushSender = pushSender;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean createIfMissing(
            Long memberId,
            Long noticeId,
            NotificationType type,
            LocalDate eventDate,
            Instant now,
            boolean emailDeliveryRequested
    ) {
        if (notificationRepository.existsByMemberIdAndNotice_IdAndTypeAndEventDate(
                memberId,
                noticeId,
                type,
                eventDate
        )) {
            return false;
        }
        MemberNotification notification = notificationRepository.saveAndFlush(new MemberNotification(
                memberRepository.getReferenceById(memberId),
                noticeRepository.getReferenceById(noticeId),
                type,
                eventDate,
                now,
                emailDeliveryRequested
        ));
        deliverAppPush(memberId, notification);
        return true;
    }

    private void deliverAppPush(Long memberId, MemberNotification notification) {
        boolean enabled = preferenceRepository.findByMember_Id(memberId)
                .map(preference -> preference.isAppPushEnabled())
                .orElse(true);
        if (!enabled) return;
        var tokens = deviceTokenRepository.findAllByMember_IdOrderByUpdatedAtDesc(memberId).stream()
                .map(token -> token.getPushToken())
                .toList();
        var result = pushSender.send(notification, tokens);
        if (!result.invalidTokens().isEmpty()) {
            deviceTokenRepository.deleteByPushTokenIn(result.invalidTokens());
        }
    }
}
