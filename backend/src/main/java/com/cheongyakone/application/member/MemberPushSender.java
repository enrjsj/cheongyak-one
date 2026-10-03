package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotification;

import java.util.List;

public interface MemberPushSender {
    default boolean enabled() { return true; }

    PushDeliveryResult send(MemberNotification notification, List<String> pushTokens);

    record PushDeliveryResult(boolean retryableFailure, List<String> invalidTokens,
                              List<String> successfulTokens, String error) {
        public PushDeliveryResult {
            invalidTokens = List.copyOf(invalidTokens);
            successfulTokens = List.copyOf(successfulTokens);
        }
        public static PushDeliveryResult none() {
            return new PushDeliveryResult(false, List.of(), List.of(), null);
        }

        public static PushDeliveryResult retryableFailure(String error) {
            return new PushDeliveryResult(true, List.of(), List.of(), error);
        }
    }
}
