package com.cheongyakone.infrastructure.push;

import com.cheongyakone.application.member.MemberPushSender;
import com.cheongyakone.domain.member.MemberNotification;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnMissingBean(MemberPushSender.class)
public class DisabledMemberPushSender implements MemberPushSender {

    @Override
    public PushDeliveryResult send(MemberNotification notification, List<String> pushTokens) {
        return PushDeliveryResult.none();
    }
}
