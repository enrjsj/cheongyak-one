package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.MemberDeviceToken;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.NotificationType;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.infrastructure.push.DisabledMemberPushSender;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberPushSafetyTest {
    @Test void wholeDeliveryFailureKeepsDevicesUnconfirmedAndRespectsBackoff() {
        var notifications = mock(MemberNotificationRepository.class);
        var devices = mock(MemberDeviceTokenRepository.class);
        var sender = mock(MemberPushSender.class);
        var receipts = mock(MemberPushReceiptStore.class);
        var clock = mock(Clock.class);
        var now = java.time.Instant.parse("2026-10-04T00:00:00Z");
        when(clock.instant()).thenReturn(now);
        var member = mock(Member.class);
        when(member.getId()).thenReturn(7L);
        var notification = new MemberNotification(member, mock(SubscriptionNotice.class), NotificationType.APPLY_START,
                java.time.LocalDate.of(2026, 10, 4), now, false, true);
        when(notifications.findForPushDelivery(42L)).thenReturn(java.util.Optional.of(notification));
        var token = mock(MemberDeviceToken.class);
        when(token.getPushToken()).thenReturn("retry-device");
        when(devices.findAllByMember_IdOrderByUpdatedAtDesc(7L)).thenReturn(List.of(token));
        when(receipts.completed(42L)).thenReturn(java.util.Set.of());
        when(sender.enabled()).thenReturn(true);
        when(sender.send(notification, List.of("retry-device")))
                .thenReturn(MemberPushSender.PushDeliveryResult.retryableFailure("FCM unavailable"))
                .thenReturn(new MemberPushSender.PushDeliveryResult(false, List.of(), List.of("retry-device"), null));
        var delivery = new MemberNotificationPushDelivery(notifications, devices, sender, clock, receipts);
        assertThat(delivery.deliver(42L)).isFalse();
        assertThat(notification.getPushAttempts()).isEqualTo(1);
        assertThat(notification.getPushNextAttemptAt()).isEqualTo(now.plusSeconds(60));
        verify(receipts, times(2)).record(42L, List.of(), now);
        verify(devices, never()).deleteByPushTokenIn(any());
        assertThat(delivery.deliver(42L)).isFalse();
        verify(sender, times(1)).send(any(), any());
        when(clock.instant()).thenReturn(now.plusSeconds(60));
        assertThat(delivery.deliver(42L)).isTrue();
        verify(sender, times(2)).send(notification, List.of("retry-device"));
        verify(receipts).record(42L, List.of("retry-device"), now.plusSeconds(60));
    }

    @Test void disabledTransportLeavesQueueUntouched() {
        var notifications = mock(MemberNotificationRepository.class);
        var devices = mock(MemberDeviceTokenRepository.class);
        var delivery = new MemberNotificationPushDelivery(notifications, devices,
                new DisabledMemberPushSender(), Clock.systemUTC(), mock(MemberPushReceiptStore.class));
        assertThat(delivery.deliver(1L)).isFalse();
        verifyNoInteractions(notifications, devices);
    }
    @Test void disabledSenderCannotReportSuccess() {
        var sender = new DisabledMemberPushSender();
        assertThat(sender.enabled()).isFalse();
        assertThat(sender.send(null, List.of("test-token")).retryableFailure()).isTrue();
    }
}

