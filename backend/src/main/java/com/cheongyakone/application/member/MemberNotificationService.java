package com.cheongyakone.application.member;

import com.cheongyakone.api.member.MemberNotificationResponse;
import com.cheongyakone.api.member.MemberRequests;
import com.cheongyakone.api.member.NotificationChannelAvailabilityResponse;
import com.cheongyakone.api.member.NotificationInboxResponse;
import com.cheongyakone.api.member.NotificationPreferenceResponse;
import com.cheongyakone.config.MemberNotificationChannelProperties;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.MemberNotificationPreference;
import com.cheongyakone.domain.member.MemberNotificationPreferenceRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

@Service
public class MemberNotificationService {

    private final MemberService memberService;
    private final MemberNotificationRepository notificationRepository;
    private final MemberNotificationPreferenceRepository preferenceRepository;
    private final MemberNotificationChannelProperties channelProperties;
    private final Clock clock;

    public MemberNotificationService(
            MemberService memberService,
            MemberNotificationRepository notificationRepository,
            MemberNotificationPreferenceRepository preferenceRepository,
            MemberNotificationChannelProperties channelProperties,
            Clock clock
    ) {
        this.memberService = memberService;
        this.notificationRepository = notificationRepository;
        this.preferenceRepository = preferenceRepository;
        this.channelProperties = channelProperties;
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
        return preferenceRepository.findByMember_Id(member.getId())
                .map(NotificationPreferenceResponse::from)
                .orElseGet(NotificationPreferenceResponse::defaults);
    }

    @Transactional(readOnly = true)
    public NotificationChannelAvailabilityResponse channelAvailability(String rawToken) {
        // 로그인한 회원에게만 실제 수신 채널의 준비 상태를 노출한다.
        memberService.requireMember(rawToken);
        return new NotificationChannelAvailabilityResponse(List.of(
                channel("EMAIL", "이메일", false, "공개 테스트에서는 이메일 발송을 아직 연결하지 않았어요."),
                channel("APP_PUSH", "앱 푸시", false, "FCM과 기기 등록을 연결하면 사용할 수 있어요."),
                channel("KAKAO_ALIMTALK", "카카오 알림톡", false,
                        channelProperties.kakaoAlimtalkDelivery().equals("disabled")
                                ? "사업자 채널·승인 템플릿을 연결한 뒤 사용할 수 있어요."
                                : "공급사 설정이 등록됐지만 실제 발송 어댑터는 아직 배포되지 않았어요."),
                channel("SMS", "문자", false,
                        channelProperties.smsDelivery().equals("disabled")
                                ? "발신번호와 문자 발송사를 연결한 뒤 사용할 수 있어요."
                                : "공급사 설정이 등록됐지만 실제 발송 어댑터는 아직 배포되지 않았어요.")
        ));
    }

    private NotificationChannelAvailabilityResponse.Channel channel(
            String id, String label, boolean available, String unavailableMessage
    ) {
        return new NotificationChannelAvailabilityResponse.Channel(
                id,
                label,
                available,
                available ? "발송 채널이 연결되어 있어요." : unavailableMessage
        );
    }

    @Transactional
    public NotificationPreferenceResponse savePreference(
            String rawToken,
            MemberRequests.NotificationPreference request
    ) {
        Member member = memberService.requireMember(rawToken);
        var preference = preferenceRepository.findByMember_Id(member.getId())
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
                request.appPushEnabled() == null || request.appPushEnabled(),
                clock.instant()
        );
        if (!request.emailEnabled()) {
            notificationRepository.cancelPendingEmailDeliveries(member.getId());
        }
        if (request.appPushEnabled() != null && !request.appPushEnabled()) {
            notificationRepository.cancelPendingPushDeliveries(member.getId());
        }
        return NotificationPreferenceResponse.from(preferenceRepository.save(preference));
    }
}
