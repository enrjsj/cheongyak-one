package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import com.cheongyakone.infrastructure.push.DisabledMemberPushSender;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberPushSafetyTest {
    @Test void disabledTransportLeavesQueueUntouched() {
        var notifications = mock(MemberNotificationRepository.class);
        var devices = mock(MemberDeviceTokenRepository.class);
        var delivery = new MemberNotificationPushDelivery(notifications, devices,
                new DisabledMemberPushSender(), Clock.systemUTC());
        assertThat(delivery.deliver(1L)).isFalse();
        verifyNoInteractions(notifications, devices);
    }
    @Test void disabledSenderCannotReportSuccess() {
        var sender = new DisabledMemberPushSender();
        assertThat(sender.enabled()).isFalse();
        assertThat(sender.send(null, List.of("test-token")).retryableFailure()).isTrue();
    }
}
