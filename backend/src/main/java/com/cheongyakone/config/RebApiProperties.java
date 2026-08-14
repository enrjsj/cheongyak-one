package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@ConfigurationProperties(prefix = "app.reb-api")
public record RebApiProperties(
        String baseUrl,
        String serviceKey,
        int pageSize,
        int maxPages
) {

    private static final String DEFAULT_BASE_URL =
            "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";

    public RebApiProperties {
        baseUrl = StringUtils.hasText(baseUrl) ? baseUrl.strip() : DEFAULT_BASE_URL;
        serviceKey = normalizeServiceKey(serviceKey);
        pageSize = pageSize > 0 ? Math.min(pageSize, 1000) : 100;
        maxPages = maxPages > 0 ? Math.min(maxPages, 100) : 20;
    }

    public String decodedServiceKey() {
        if (!StringUtils.hasText(serviceKey)) {
            throw new IllegalStateException("REB_API_KEY is not configured");
        }

        return serviceKey.contains("%")
                ? URLDecoder.decode(serviceKey, StandardCharsets.UTF_8)
                : serviceKey;
    }

    private static String normalizeServiceKey(String configuredValue) {
        if (!StringUtils.hasText(configuredValue)) {
            return "";
        }

        String normalized = configuredValue.strip();
        if (normalized.startsWith("REB_API_KEY=")) {
            normalized = normalized.substring("REB_API_KEY=".length()).strip();
        }

        int lineBreak = normalized.indexOf('\n');
        if (lineBreak >= 0) {
            normalized = normalized.substring(0, lineBreak).strip();
        }

        if (normalized.length() >= 2) {
            char first = normalized.charAt(0);
            char last = normalized.charAt(normalized.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                normalized = normalized.substring(1, normalized.length() - 1).strip();
            }
        }

        return normalized;
    }
}
