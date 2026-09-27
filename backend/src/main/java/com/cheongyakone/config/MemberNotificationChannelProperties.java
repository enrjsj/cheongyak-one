package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.member-notification-channel")
public record MemberNotificationChannelProperties(
        String kakaoAlimtalkDelivery,
        String smsDelivery
) {
    public MemberNotificationChannelProperties {
        kakaoAlimtalkDelivery = normalize(kakaoAlimtalkDelivery);
        smsDelivery = normalize(smsDelivery);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? "disabled" : value.trim().toLowerCase();
    }
}
