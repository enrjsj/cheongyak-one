package com.cheongyakone.infrastructure.push;

// 하이브리드 앱의 FCM 기기 토큰으로 알림을 전송하는 인프라 어댑터다.

import com.cheongyakone.application.member.MemberPushSender;
import com.cheongyakone.domain.member.MemberNotification;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.SendResponse;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Component
@ConditionalOnProperty(prefix = "app.member-push", name = "delivery", havingValue = "fcm")
public class FcmMemberPushSender implements MemberPushSender {

    private static final Logger log = LoggerFactory.getLogger(FcmMemberPushSender.class);
    private final String serviceAccountBase64;
    private FirebaseMessaging messaging;

    public FcmMemberPushSender(
            @org.springframework.beans.factory.annotation.Value("${app.member-push.fcm-service-account-base64:}") String serviceAccountBase64
    ) {
        this.serviceAccountBase64 = serviceAccountBase64;
    }

    @PostConstruct
    void initialize() throws IOException {
        if (serviceAccountBase64.isBlank()) {
            throw new IllegalStateException("MEMBER_PUSH_FCM_SERVICE_ACCOUNT_BASE64 must be set when MEMBER_PUSH_DELIVERY=fcm");
        }
        byte[] json = Base64.getDecoder().decode(serviceAccountBase64);
        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(new ByteArrayInputStream(json)))
                .build();
        FirebaseApp app = FirebaseApp.getApps().isEmpty() ? FirebaseApp.initializeApp(options) : FirebaseApp.getInstance();
        this.messaging = FirebaseMessaging.getInstance(app);
    }

    @Override
    public PushDeliveryResult send(MemberNotification notification, List<String> pushTokens) {
        if (pushTokens.isEmpty()) return PushDeliveryResult.none();
        MulticastMessage.Builder builder = MulticastMessage.builder()
                .addAllTokens(pushTokens)
                .putData("notificationId", String.valueOf(notification.getId()))
                .putData("noticeId", String.valueOf(notification.getNoticeId()))
                .putData("type", notification.getType().name())
                .putData("deepLink", "cheongyakone://notices/" + notification.getNoticeId())
                .setNotification(com.google.firebase.messaging.Notification.builder()
                        .setTitle(notification.getNoticeTitle())
                        .setBody(notification.getType().message())
                        .build());
        try {
            BatchResponse response = messaging.sendEachForMulticast(builder.build());
            List<String> invalidTokens = new ArrayList<>();
            for (int index = 0; index < response.getResponses().size(); index++) {
                SendResponse sendResponse = response.getResponses().get(index);
                if (!sendResponse.isSuccessful() && isInvalidToken(sendResponse.getException())) {
                    invalidTokens.add(pushTokens.get(index));
                }
            }
            if (response.getFailureCount() > 0) {
                log.warn("FCM member push partially failed: notificationId={}, failures={}", notification.getId(), response.getFailureCount());
            }
            boolean retryableFailure = response.getResponses().stream()
                    .filter(sendResponse -> !sendResponse.isSuccessful())
                    .anyMatch(sendResponse -> !isInvalidToken(sendResponse.getException()));
            return new PushDeliveryResult(retryableFailure, invalidTokens,
                    retryableFailure ? "FCM partial delivery failure" : null);
        } catch (FirebaseMessagingException exception) {
            log.error("FCM member push failed: notificationId={}", notification.getId(), exception);
            return PushDeliveryResult.retryableFailure(
                    exception.getClass().getSimpleName() + ": " + exception.getMessage()
            );
        }
    }

    private boolean isInvalidToken(FirebaseMessagingException exception) {
        if (exception == null || exception.getMessagingErrorCode() == null) return false;
        return switch (exception.getMessagingErrorCode()) {
            case UNREGISTERED, INVALID_ARGUMENT -> true;
            default -> false;
        };
    }
}
