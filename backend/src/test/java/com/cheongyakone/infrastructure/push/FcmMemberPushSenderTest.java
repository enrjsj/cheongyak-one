package com.cheongyakone.infrastructure.push;

import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.SendResponse;
import com.google.firebase.FirebaseException;
import com.google.firebase.ErrorCode;
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
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.verify;

class FcmMemberPushSenderTest {
    @Test void unexpectedMiddleBatchFailureKeepsOtherConfirmationsAndSanitizesLogs() throws Exception {
        var messaging = mock(FirebaseMessaging.class);
        var first = acceptedBatch(500);
        var last = acceptedBatch(1);
        when(messaging.sendEachForMulticast(any(MulticastMessage.class)))
                .thenReturn(first).thenThrow(new IllegalStateException("private-device-token"))
                .thenReturn(last);
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(FcmMemberPushSender.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        try {
            var tokens = java.util.stream.IntStream.range(0, 1001).mapToObj(i -> "device-" + i).toList();
            var result = sender(messaging).send(notification(42L), tokens);
            var confirmed = new java.util.ArrayList<>(tokens.subList(0, 500));
            confirmed.add(tokens.get(1000));
            assertThat(result.successfulTokens()).containsExactlyElementsOf(confirmed);
            assertThat(result.invalidTokens()).isEmpty();
            assertThat(result.retryableFailure()).isTrue();
            assertThat(result.error()).isEqualTo("FCM batch result unavailable");
            assertThat(appender.list).hasSize(1);
            assertThat(appender.list.get(0).getFormattedMessage())
                    .contains("notificationId=42", "IllegalStateException").doesNotContain("private-device-token");
            assertThat(appender.list.get(0).getThrowableProxy()).isNull();
            verify(messaging, org.mockito.Mockito.times(3)).sendEachForMulticast(any(MulticastMessage.class));
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test void sendStillRejectsInvalidLocalNotificationBeforeCallingProvider() {
        var messaging = mock(FirebaseMessaging.class);
        assertThatThrownBy(() -> sender(messaging).send(notification(null), List.of("device")))
                .isInstanceOf(IllegalArgumentException.class);
        org.mockito.Mockito.verifyNoInteractions(messaging);
    }

    @Test void fatalErrorsAreNotConvertedIntoRetryResults() throws Exception {
        var messaging = mock(FirebaseMessaging.class);
        when(messaging.sendEachForMulticast(any(MulticastMessage.class))).thenThrow(new AssertionError("fatal"));
        assertThatThrownBy(() -> sender(messaging).send(notification(42L), List.of("device")))
                .isInstanceOf(AssertionError.class);
    }

    @Test void multicastBatchesRespectBoundaryAndPreserveEveryToken() throws Exception {
        for (int count : new int[]{1, 499, 500, 501, 1001}) {
            var messaging = mock(FirebaseMessaging.class);
            var observed = new java.util.ArrayList<String>();
            var sizes = new java.util.ArrayList<Integer>();
            when(messaging.sendEachForMulticast(any(MulticastMessage.class))).thenAnswer(invocation -> {
                List<String> tokens = messageTokens(invocation.getArgument(0));
                sizes.add(tokens.size()); observed.addAll(tokens);
                return acceptedBatch(tokens.size());
            });
            var tokens = java.util.stream.IntStream.range(0, count).mapToObj(i -> "device-" + i).toList();
            var result = sender(messaging).send(notification(42L), tokens);
            assertThat(observed).containsExactlyElementsOf(tokens);
            assertThat(sizes).hasSize((count + 499) / 500).allMatch(size -> size > 0 && size <= 500);
            assertThat(result.successfulTokens()).containsExactlyElementsOf(tokens);
            assertThat(result.invalidTokens()).isEmpty();
            assertThat(result.retryableFailure()).isFalse();
        }
    }

    @Test void middleBatchFailurePreservesEarlierAndLaterConfirmations() throws Exception {
        var messaging = mock(FirebaseMessaging.class);
        var first = acceptedBatch(500);
        var last = mock(BatchResponse.class);
        var invalidResponse = failed(MessagingErrorCode.UNREGISTERED);
        when(last.getResponses()).thenReturn(List.of(invalidResponse));
        when(last.getFailureCount()).thenReturn(1);
        when(messaging.sendEachForMulticast(any(MulticastMessage.class)))
                .thenReturn(first).thenThrow(failure(MessagingErrorCode.UNAVAILABLE)).thenReturn(last);
        var tokens = java.util.stream.IntStream.range(0, 1001).mapToObj(i -> "device-" + i).toList();
        var result = sender(messaging).send(notification(42L), tokens);
        assertThat(result.successfulTokens()).containsExactlyElementsOf(tokens.subList(0, 500));
        assertThat(result.invalidTokens()).containsExactly("device-1000");
        assertThat(result.retryableFailure()).isTrue();
        assertThat(result.error()).isEqualTo("FCM delivery failed: UNAVAILABLE");
        var unconfirmed = tokens.stream().filter(token -> !result.successfulTokens().contains(token)
                && !result.invalidTokens().contains(token)).toList();
        assertThat(unconfirmed).containsExactlyElementsOf(tokens.subList(500, 1000));
        verify(messaging, org.mockito.Mockito.times(3)).sendEachForMulticast(any(MulticastMessage.class));
    }

    private static List<String> messageTokens(MulticastMessage message) {
        return (List<String>) ReflectionTestUtils.getField(message, "tokens");
    }

    private static BatchResponse acceptedBatch(int count) {
        SendResponse success = ReflectionTestUtils.invokeMethod(SendResponse.class, "fromMessageId", "test-message");
        var batch = mock(BatchResponse.class);
        when(batch.getResponses()).thenReturn(java.util.Collections.nCopies(count, success));
        return batch;
    }

    @Test void mixedResponsesPreserveTokenOrderAndOnlyRemoveUnregisteredDevices() throws Exception {
        var messaging = mock(FirebaseMessaging.class);
        var batch = mock(BatchResponse.class);
        SendResponse success = ReflectionTestUtils.invokeMethod(SendResponse.class, "fromMessageId", "message-id");
        when(batch.getResponses()).thenReturn(List.of(success, failed(MessagingErrorCode.UNREGISTERED),
                failed(MessagingErrorCode.UNAVAILABLE), failed(MessagingErrorCode.INVALID_ARGUMENT)));
        when(batch.getFailureCount()).thenReturn(3);
        when(messaging.sendEachForMulticast(any(MulticastMessage.class))).thenReturn(batch);
        var sender = sender(messaging);
        var result = sender.send(notification(42L), List.of("ok", "expired", "retry", "bad-payload"));
        assertThat(result.successfulTokens()).containsExactly("ok");
        assertThat(result.invalidTokens()).containsExactly("expired");
        assertThat(result.retryableFailure()).isTrue();
        assertThat(result.error()).isEqualTo("FCM partial delivery failure");
        verify(messaging).sendEachForMulticast(any(MulticastMessage.class));
    }

    @Test void confirmedInvalidDevicesAloneDoNotRequireAnotherAttempt() throws Exception {
        var messaging = mock(FirebaseMessaging.class);
        var batch = mock(BatchResponse.class);
        when(batch.getResponses()).thenReturn(List.of(failed(MessagingErrorCode.UNREGISTERED)));
        when(batch.getFailureCount()).thenReturn(1);
        when(messaging.sendEachForMulticast(any(MulticastMessage.class))).thenReturn(batch);
        var result = sender(messaging).send(notification(42L), List.of("expired"));
        assertThat(result.retryableFailure()).isFalse();
        assertThat(result.successfulTokens()).isEmpty();
        assertThat(result.invalidTokens()).containsExactly("expired");
        assertThat(result.error()).isNull();
    }

    @Test void wholeRequestFailureCannotConfirmOrDeleteAnyDevice() throws Exception {
        var messaging = mock(FirebaseMessaging.class);
        when(messaging.sendEachForMulticast(any(MulticastMessage.class))).thenThrow(failure(MessagingErrorCode.UNAVAILABLE));
        var result = sender(messaging).send(notification(42L), List.of("device-a", "device-b"));
        assertThat(result.retryableFailure()).isTrue();
        assertThat(result.successfulTokens()).isEmpty();
        assertThat(result.invalidTokens()).isEmpty();
        assertThat(result.error()).isEqualTo("FCM delivery failed: UNAVAILABLE");
        assertThat(result.error()).doesNotContain("private-provider-detail");
    }

    private static FcmMemberPushSender sender(FirebaseMessaging messaging) {
        var sender = new FcmMemberPushSender("");
        ReflectionTestUtils.setField(sender, "messaging", messaging);
        return sender;
    }

    private static FirebaseMessagingException failure(MessagingErrorCode code) {
        return ReflectionTestUtils.invokeMethod(FirebaseMessagingException.class, "withMessagingErrorCode",
                new FirebaseException(ErrorCode.UNAVAILABLE, "private-provider-detail", null), code);
    }

    private static SendResponse failed(MessagingErrorCode code) {
        return ReflectionTestUtils.invokeMethod(SendResponse.class, "fromException", failure(code));
    }

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
