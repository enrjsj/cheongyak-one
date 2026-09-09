package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.member-mail")
public record MemberMailProperties(boolean verificationRequired, String frontendBaseUrl, String fromAddress) {

    public MemberMailProperties {
        frontendBaseUrl = frontendBaseUrl == null || frontendBaseUrl.isBlank()
                ? "http://localhost:5173"
                : frontendBaseUrl.replaceAll("/+$", "");
        fromAddress = fromAddress == null || fromAddress.isBlank() ? "no-reply@localhost" : fromAddress;
    }
}
