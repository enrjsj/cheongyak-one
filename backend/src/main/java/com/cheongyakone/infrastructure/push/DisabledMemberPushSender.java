package com.cheongyakone.infrastructure.push;

import com.cheongyakone.application.member.MemberPushSender;
import com.cheongyakone.domain.member.MemberNotification;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(prefix = "app.member-push", name = "delivery", havingValue = "disabled", matchIfMissing = true)
public class DisabledMemberPushSender implements MemberPushSender {

    @Override
    public PushDeliveryResult send(MemberNotification notification, List<String> pushTokens) {
        return PushDeliveryResult.none();
    }
}
