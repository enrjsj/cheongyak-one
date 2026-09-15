package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotification;

import java.util.List;

public interface MemberPushSender {

    PushDeliveryResult send(MemberNotification notification, List<String> pushTokens);

    record PushDeliveryResult(List<String> invalidTokens) {
        public static PushDeliveryResult none() {
            return new PushDeliveryResult(List.of());
        }
    }
}
