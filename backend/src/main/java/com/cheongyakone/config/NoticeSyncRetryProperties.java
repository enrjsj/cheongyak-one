package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.notice-sync.retry")
public record NoticeSyncRetryProperties(
        int maxAttempts,
        Duration delay
) {

    public NoticeSyncRetryProperties {
        // 설정 오류로 배치가 과도하게 지연되지 않도록 재시도 횟수와 대기 시간을 제한한다.
        maxAttempts = maxAttempts > 0 ? Math.min(maxAttempts, 5) : 3;
        delay = delay != null && !delay.isNegative() ? delay : Duration.ofSeconds(2);
        if (delay.compareTo(Duration.ofMinutes(1)) > 0) {
            delay = Duration.ofMinutes(1);
        }
    }
}
