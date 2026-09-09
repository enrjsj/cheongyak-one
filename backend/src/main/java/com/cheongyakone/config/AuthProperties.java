package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties("app.auth")
public record AuthProperties(
        String cookieName,
        String csrfCookieName,
        Duration sessionDuration,
        boolean secureCookie
) {
    public AuthProperties {
        cookieName = cookieName == null || cookieName.isBlank() ? "CHEONGYAK_SESSION" : cookieName;
        csrfCookieName = csrfCookieName == null || csrfCookieName.isBlank() ? "CHEONGYAK_CSRF" : csrfCookieName;
        sessionDuration = sessionDuration == null ? Duration.ofDays(14) : sessionDuration;
    }
}
