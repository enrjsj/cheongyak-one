package com.cheongyakone.application.member;

import com.cheongyakone.config.MemberNotificationChannelProperties;
import com.cheongyakone.domain.member.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import java.time.Clock;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberNotificationChannelTest {
    @Test void readinessReflectsTransportAndRegisteredDeviceButNeverEnablesMissingSmsAdapter() {
        var members = mock(MemberService.class);
        var member = mock(Member.class);
        when(member.getId()).thenReturn(1L);
        when(members.requireMember("session")).thenReturn(member);
        var devices = mock(MemberDeviceTokenRepository.class);
        var env = new MockEnvironment().withProperty("app.member-mail.delivery", "smtp")
                .withProperty("app.member-push.delivery", "fcm");
        var service = new MemberNotificationService(members, mock(MemberNotificationRepository.class),
                mock(MemberNotificationPreferenceRepository.class),
                new MemberNotificationChannelProperties("configured", "configured"), Clock.systemUTC(), env, devices);
        var channels = service.channelAvailability("session").channels();
        assertThat(channels.get(0).available()).isTrue();
        assertThat(channels.get(1).available()).isFalse();
        assertThat(channels.get(2).available()).isFalse();
        assertThat(channels.get(3).available()).isFalse();
        when(devices.existsByMember_Id(1L)).thenReturn(true);
        assertThat(service.channelAvailability("session").channels().get(1).available()).isTrue();
    }
}
