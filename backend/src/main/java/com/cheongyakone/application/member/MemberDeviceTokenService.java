package com.cheongyakone.application.member;

import com.cheongyakone.api.member.MemberDeviceTokenResponse;
import com.cheongyakone.api.member.MemberRequests;
import com.cheongyakone.domain.member.MemberDeviceToken;
import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;

@Service
public class MemberDeviceTokenService {

    private final MemberService memberService;
    private final MemberDeviceTokenRepository deviceTokenRepository;
    private final Clock clock;

    public MemberDeviceTokenService(MemberService memberService, MemberDeviceTokenRepository deviceTokenRepository, Clock clock) {
        this.memberService = memberService;
        this.deviceTokenRepository = deviceTokenRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MemberDeviceTokenResponse> devices(String rawToken) {
        var member = memberService.requireMember(rawToken);
        return deviceTokenRepository.findAllByMember_IdOrderByUpdatedAtDesc(member.getId()).stream()
                .map(MemberDeviceTokenResponse::from)
                .toList();
    }

    @Transactional
    public MemberDeviceTokenResponse register(String rawToken, MemberRequests.DeviceToken request) {
        var member = memberService.requireMember(rawToken);
        var now = clock.instant();
        MemberDeviceToken deviceToken = deviceTokenRepository.findByPushToken(request.pushToken().trim())
                .orElseGet(() -> new MemberDeviceToken(member, request.pushToken(), request.platform(), now));
        if (deviceToken.getId() != null) {
            deviceToken.refresh(member, request.platform(), now);
        }
        return MemberDeviceTokenResponse.from(deviceTokenRepository.save(deviceToken));
    }

    @Transactional
    public void unregister(String rawToken, MemberRequests.DeviceTokenRemoval request) {
        var member = memberService.requireMember(rawToken);
        deviceTokenRepository.deleteByMember_IdAndPushToken(member.getId(), request.pushToken().trim());
    }
}
