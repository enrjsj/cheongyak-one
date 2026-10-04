package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.*;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.*;
import java.util.*;
import static com.cheongyakone.domain.member.MemberNotification.PushCompletionReason.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberPushOutcomeTest {
    final Instant now = Instant.parse("2026-10-04T00:00:00Z");
    final MemberNotificationRepository notifications = mock(MemberNotificationRepository.class);
    final MemberDeviceTokenRepository devices = mock(MemberDeviceTokenRepository.class);
    final MemberPushSender sender = mock(MemberPushSender.class);
    final MemberPushReceiptStore receipts;
    final MemberNotification notification;
    final MemberNotificationPushDelivery delivery;

    MemberPushOutcomeTest() {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        var jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE MEMBER_PUSH_RECEIPT (NOTIFICATION_ID BIGINT, TOKEN_HASH VARCHAR(64), COMPLETED_AT TIMESTAMP WITH TIME ZONE, OUTCOME VARCHAR(24), PRIMARY KEY(NOTIFICATION_ID,TOKEN_HASH))");
        receipts = new MemberPushReceiptStore(jdbc);
        var member = mock(Member.class);
        when(member.getId()).thenReturn(7L);
        notification = new MemberNotification(member, mock(SubscriptionNotice.class), NotificationType.APPLY_START,
                LocalDate.of(2026, 10, 4), now, false, true);
        when(notifications.findForPushDelivery(42L)).thenReturn(Optional.of(notification));
        when(sender.enabled()).thenReturn(true);
        delivery = new MemberNotificationPushDelivery(notifications, devices, sender, Clock.fixed(now, ZoneOffset.UTC), receipts);
    }

    @Test void noDevicesCompletesWithoutClaimingAcceptanceOrRetrying() {
        assertThat(delivery.deliver(42L)).isFalse();
        assertThat(notification.getPushCompletionReason()).isEqualTo(NO_DEVICES);
        assertThat(notification.isPushDeliveryDue(now.plusSeconds(60), 5)).isFalse();
        verify(sender, never()).send(any(), any());
    }

    @Test void onlyInvalidTokensDoNotCountAsAccepted() {
        tokens("expired");
        when(sender.send(any(), any())).thenReturn(new MemberPushSender.PushDeliveryResult(false, List.of("expired"), List.of(), null));
        assertThat(delivery.deliver(42L)).isFalse();
        assertThat(notification.getPushCompletionReason()).isEqualTo(INVALID_TOKENS);
        verify(devices).deleteByPushTokenIn(List.of("expired"));
        assertThat(notification.retryFailedPush(now, 5)).isFalse();
    }

    @Test void mixedAcceptanceAndInvalidTokenCountsOnceAsAccepted() {
        tokens("ok", "expired");
        when(sender.send(any(), any())).thenReturn(new MemberPushSender.PushDeliveryResult(false, List.of("expired"), List.of("ok"), null));
        assertThat(delivery.deliver(42L)).isTrue();
        assertThat(notification.getPushCompletionReason()).isEqualTo(ACCEPTED);
        assertThat(delivery.deliver(42L)).isFalse();
        verify(sender, times(1)).send(any(), any());
    }

    @Test void earlierAcceptanceSurvivesMissingRemainingDevices() {
        receipts.recordAccepted(42L, List.of("previous-ok"), now);
        assertThat(delivery.deliver(42L)).isTrue();
        assertThat(notification.getPushCompletionReason()).isEqualTo(ACCEPTED);
    }

    @Test void earlierInvalidTokensSurviveProcessRestart() {
        receipts.recordInvalid(42L, List.of("expired"), now);
        assertThat(delivery.deliver(42L)).isFalse();
        assertThat(notification.getPushCompletionReason()).isEqualTo(INVALID_TOKENS);
    }

    @Test void legacyReceiptsAreNeverGuessedToBeSuccessful() {
        receipts.record(42L, List.of("legacy"), now);
        assertThat(delivery.deliver(42L)).isFalse();
        assertThat(notification.getPushCompletionReason()).isEqualTo(UNKNOWN);
    }

    private void tokens(String... values) {
        var deviceList = Arrays.stream(values).map(value -> {
            var device = mock(MemberDeviceToken.class);
            when(device.getPushToken()).thenReturn(value);
            return device;
        }).toList();
        when(devices.findAllByMember_IdOrderByUpdatedAtDesc(7L)).thenReturn(deviceList);
    }
}

