package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.*;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberPushReceiptTest {
    @Test void retryOnlyTargetsUnconfirmedDevicesAndStoresHashes() {
        var source = new JdbcDataSource();
        source.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        var jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE MEMBER_PUSH_RECEIPT (NOTIFICATION_ID BIGINT, TOKEN_HASH VARCHAR(64), COMPLETED_AT TIMESTAMP WITH TIME ZONE, OUTCOME VARCHAR(24), PRIMARY KEY(NOTIFICATION_ID,TOKEN_HASH))");
        var receipts = new MemberPushReceiptStore(jdbc);
        var members = mock(Member.class);
        when(members.getId()).thenReturn(7L);
        Instant now = Instant.parse("2026-10-04T00:00:00Z");
        var notification = new MemberNotification(members, mock(SubscriptionNotice.class),
                NotificationType.values()[0], LocalDate.of(2026,10,4), now, false, true);
        var notifications = mock(MemberNotificationRepository.class);
        when(notifications.findForPushDelivery(1L)).thenReturn(Optional.of(notification));
        var devices = mock(MemberDeviceTokenRepository.class);
        var deviceList = List.of(device("successful"), device("retry"), device("invalid"));
        when(devices.findAllByMember_IdOrderByUpdatedAtDesc(7L)).thenReturn(deviceList);
        var sender = mock(MemberPushSender.class);
        when(sender.enabled()).thenReturn(true);
        when(sender.send(notification, List.of("successful", "retry", "invalid"))).thenReturn(
                new MemberPushSender.PushDeliveryResult(true, List.of("invalid"), List.of("successful"), "retry"));
        when(sender.send(notification, List.of("retry"))).thenReturn(
                new MemberPushSender.PushDeliveryResult(false, List.of(), List.of("retry"), null));
        var clock = mock(Clock.class);
        when(clock.instant()).thenReturn(now);
        var delivery = new MemberNotificationPushDelivery(notifications, devices, sender, clock, receipts);
        assertThat(delivery.deliver(1L)).isFalse();
        assertThat(receipts.completed(1L)).containsExactlyInAnyOrder(
                MemberPushReceiptStore.hash("successful"), MemberPushReceiptStore.hash("invalid"));
        verify(devices).deleteByPushTokenIn(List.of("invalid"));
        when(clock.instant()).thenReturn(now.plusSeconds(60));
        // Recreating the store simulates process restart; successful device must remain excluded.
        delivery = new MemberNotificationPushDelivery(notifications, devices, sender, clock, new MemberPushReceiptStore(jdbc));
        assertThat(delivery.deliver(1L)).isTrue();
        verify(sender).send(notification, List.of("retry"));
        verify(sender).send(notification, List.of("successful", "retry", "invalid"));
        assertThat(delivery.deliver(1L)).isFalse();
        verify(sender, times(3)).enabled();
        verifyNoMoreInteractions(sender);
    }
    private MemberDeviceToken device(String token) {
        var device = mock(MemberDeviceToken.class);
        when(device.getPushToken()).thenReturn(token);
        return device;
    }
}

