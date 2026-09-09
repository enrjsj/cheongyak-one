package com.cheongyakone.application.member;

import com.cheongyakone.api.member.MemberNotificationResponse;
import com.cheongyakone.api.member.MemberRequests;
import com.cheongyakone.api.member.NotificationInboxResponse;
import com.cheongyakone.api.member.NotificationPreferenceResponse;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.MemberNotificationPreference;
import com.cheongyakone.domain.member.MemberNotificationPreferenceRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

@Service
public class MemberNotificationService {

    private final MemberService memberService;
    private final MemberNotificationRepository notificationRepository;
    private final MemberNotificationPreferenceRepository preferenceRepository;
    private final Clock clock;

    public MemberNotificationService(
            MemberService memberService,
            MemberNotificationRepository notificationRepository,
            MemberNotificationPreferenceRepository preferenceRepository,
            Clock clock
    ) {
        this.memberService = memberService;
        this.notificationRepository = notificationRepository;
        this.preferenceRepository = preferenceRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public NotificationInboxResponse inbox(String rawToken) {
        Member member = memberService.requireMember(rawToken);
        return new NotificationInboxResponse(
                notificationRepository.findTop50ByMemberIdOrderByCreatedAtDescIdDesc(member.getId()).stream()
                        .map(MemberNotificationResponse::from)
                        .toList(),
                notificationRepository.countByMemberIdAndReadAtIsNull(member.getId())
        );
    }

    @Transactional
    public MemberNotificationResponse markRead(String rawToken, Long notificationId) {
        Member member = memberService.requireMember(rawToken);
        MemberNotification notification = notificationRepository.findByIdAndMemberId(notificationId, member.getId())
                .orElseThrow(() -> new MemberApiException(
                        HttpStatus.NOT_FOUND,
                        "NOTIFICATION_NOT_FOUND",
                        "이미 삭제됐거나 찾을 수 없는 알림입니다."
                ));
        notification.markRead(clock.instant());
        return MemberNotificationResponse.from(notification);
    }

    @Transactional
    public void markAllRead(String rawToken) {
        Member member = memberService.requireMember(rawToken);
        for (MemberNotification notification : notificationRepository.findAllByMemberIdAndReadAtIsNull(member.getId())) {
            notification.markRead(clock.instant());
        }
    }

    @Transactional(readOnly = true)
    public NotificationPreferenceResponse preference(String rawToken) {
        Member member = memberService.requireMember(rawToken);
        return preferenceRepository.findByMemberId(member.getId())
                .map(NotificationPreferenceResponse::from)
                .orElseGet(NotificationPreferenceResponse::defaults);
    }

    @Transactional
    public NotificationPreferenceResponse savePreference(
            String rawToken,
            MemberRequests.NotificationPreference request
    ) {
        Member member = memberService.requireMember(rawToken);
        var preference = preferenceRepository.findByMemberId(member.getId())
                .orElseGet(() -> new MemberNotificationPreference(member, clock.instant()));
        preference.change(
                request.applyStartEnabled(),
                request.deadline7dEnabled(),
                request.deadline3dEnabled(),
                request.deadline1dEnabled(),
                request.winnerEnabled(),
                request.newMatchingNoticeEnabled(),
                request.noticeUpdatedEnabled() == null || request.noticeUpdatedEnabled(),
                request.emailEnabled(),
                clock.instant()
        );
        if (!request.emailEnabled()) {
            notificationRepository.cancelPendingEmailDeliveries(member.getId());
        }
        return NotificationPreferenceResponse.from(preferenceRepository.save(preference));
    }
}
