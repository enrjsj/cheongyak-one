package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@ConfigurationProperties(prefix = "app.scheduled-notice-sync")
public record ScheduledNoticeSyncProperties(boolean enabled, String apiKey) {

    public ScheduledNoticeSyncProperties {
        apiKey = apiKey == null ? "" : apiKey.strip();
    }

    public boolean accepts(String suppliedKey) {
        if (!enabled || !StringUtils.hasText(apiKey) || !StringUtils.hasText(suppliedKey)) {
            return false;
        }
        return MessageDigest.isEqual(
                apiKey.getBytes(StandardCharsets.UTF_8),
                suppliedKey.strip().getBytes(StandardCharsets.UTF_8)
        );
    }

    public boolean isConfigured() {
        return enabled && StringUtils.hasText(apiKey);
    }
}
