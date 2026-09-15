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

    public MemberNotificationWriter(
            MemberNotificationRepository notificationRepository,
            MemberRepository memberRepository,
            SubscriptionNoticeRepository noticeRepository,
            MemberNotificationPreferenceRepository preferenceRepository,
            MemberDeviceTokenRepository deviceTokenRepository
    ) {
        this.notificationRepository = notificationRepository;
        this.memberRepository = memberRepository;
        this.noticeRepository = noticeRepository;
        this.preferenceRepository = preferenceRepository;
        this.deviceTokenRepository = deviceTokenRepository;
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
        boolean pushDeliveryRequested = preferenceRepository.findByMember_Id(memberId)
                .map(preference -> preference.isAppPushEnabled())
                .orElse(true)
                && deviceTokenRepository.existsByMember_Id(memberId);
        notificationRepository.saveAndFlush(new MemberNotification(
                memberRepository.getReferenceById(memberId),
                noticeRepository.getReferenceById(noticeId),
                type,
                eventDate,
                now,
                emailDeliveryRequested,
                pushDeliveryRequested
        ));
        return true;
    }
}
