package com.cheongyakone.infrastructure.push;

import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Message;
import com.google.api.client.json.gson.GsonFactory;
import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.NotificationType;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FcmMemberPushSenderTest {
    @Test void retriesKeepDisplayIdentityAndExistingPayloadForEveryDevice() throws Exception {
        var first = payloads(42L, List.of("device-a", "device-b"));
        var retry = payloads(42L, List.of("device-b"));
        assertThat(first).hasSize(2);
        assertThat(retry).hasSize(1);
        assertThat(first.get(0).get("token").getAsString()).isEqualTo("device-a");
        assertThat(first.get(1)).isEqualTo(retry.get(0));
        for (JsonObject message : first) {
            assertThat(tag(message)).isEqualTo("cheongyak-notification-42");
            assertThat(collapseId(message)).isEqualTo(tag(message));
            assertThat(message.getAsJsonObject("data").get("notificationId").getAsString()).isEqualTo("42");
            assertThat(message.getAsJsonObject("data").get("noticeId").getAsString()).isEqualTo("7");
            assertThat(message.getAsJsonObject("data").get("type").getAsString()).isEqualTo("APPLY_START");
            assertThat(message.getAsJsonObject("data").get("deepLink").getAsString()).isEqualTo("cheongyakone://notices/7");
            assertThat(message.getAsJsonObject("notification").get("title").getAsString()).isEqualTo("테스트 공고");
            assertThat(message.getAsJsonObject("notification").get("body").getAsString()).isEqualTo(NotificationType.APPLY_START.message());
            assertThat(message.getAsJsonObject("android").has("collapse_key")).isFalse();
        }
    }

    @Test void separateEventsForTheSameNoticeDoNotReplaceEachOther() throws Exception {
        var first = payloads(42L, List.of("device-a")).get(0);
        var next = payloads(43L, List.of("device-a")).get(0);
        assertThat(tag(first)).isNotEqualTo(tag(next));
        assertThat(collapseId(first)).isNotEqualTo(collapseId(next));
        var largest = payloads(Long.MAX_VALUE, List.of("device-a")).get(0);
        assertThat(collapseId(largest).getBytes(java.nio.charset.StandardCharsets.UTF_8).length).isLessThanOrEqualTo(64);
    }

    @Test void unsavedNotificationsCannotShareAnInvalidDisplayKey() {
        for (Long id : new Long[]{null, 0L, -1L}) {
            assertThatThrownBy(() -> FcmMemberPushSender.buildMessage(notification(id), List.of("device-a")))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test void noDevicesDoesNotInitializeOrCallFirebase() {
        assertThat(new FcmMemberPushSender("").send(notification(null), List.of()).successfulTokens()).isEmpty();
    }

    private static MemberNotification notification(Long id) {
        MemberNotification notification = mock(MemberNotification.class);
        when(notification.getId()).thenReturn(id);
        when(notification.getNoticeId()).thenReturn(7L);
        when(notification.getNoticeTitle()).thenReturn("테스트 공고");
        when(notification.getType()).thenReturn(NotificationType.APPLY_START);
        return notification;
    }

    private static List<JsonObject> payloads(Long id, List<String> tokens) throws Exception {
        var multicast = FcmMemberPushSender.buildMessage(notification(id), tokens);
        // Inspect the SDK's actual per-device wire messages, without credentials or sending.
        List<Message> messages = ReflectionTestUtils.invokeMethod(multicast, "getMessageList");
        var result = new java.util.ArrayList<JsonObject>();
        for (Message message : messages) {
            result.add(JsonParser.parseString(GsonFactory.getDefaultInstance().toString(message)).getAsJsonObject());
        }
        return result;
    }

    private static String tag(JsonObject message) {
        return message.getAsJsonObject("android").getAsJsonObject("notification").get("tag").getAsString();
    }

    private static String collapseId(JsonObject message) {
        return message.getAsJsonObject("apns").getAsJsonObject("headers").get("apns-collapse-id").getAsString();
    }

    @Test void onlyConfirmedUnregisteredTokensAreDeleted() {
        for (MessagingErrorCode code : MessagingErrorCode.values()) {
            assertThat(FcmMemberPushSender.isExpiredToken(code))
                    .isEqualTo(code == MessagingErrorCode.UNREGISTERED);
        }
        assertThat(FcmMemberPushSender.isExpiredToken(null)).isFalse();
    }
}

