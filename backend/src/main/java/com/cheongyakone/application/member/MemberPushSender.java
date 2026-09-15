package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotification;

import java.util.List;

public interface MemberPushSender {

    PushDeliveryResult send(MemberNotification notification, List<String> pushTokens);

    record PushDeliveryResult(boolean retryableFailure, List<String> invalidTokens, String error) {
        public static PushDeliveryResult none() {
            return new PushDeliveryResult(false, List.of(), null);
        }

        public static PushDeliveryResult retryableFailure(String error) {
            return new PushDeliveryResult(true, List.of(), error);
        }
    }
}
