package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotification;
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

    public MemberNotificationWriter(
            MemberNotificationRepository notificationRepository,
            MemberRepository memberRepository,
            SubscriptionNoticeRepository noticeRepository
    ) {
        this.notificationRepository = notificationRepository;
        this.memberRepository = memberRepository;
        this.noticeRepository = noticeRepository;
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
        notificationRepository.saveAndFlush(new MemberNotification(
                memberRepository.getReferenceById(memberId),
                noticeRepository.getReferenceById(noticeId),
                type,
                eventDate,
                now,
                emailDeliveryRequested
        ));
        return true;
    }
}
