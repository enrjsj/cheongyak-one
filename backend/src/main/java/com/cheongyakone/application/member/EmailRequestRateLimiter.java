package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.Member;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** 이메일 발송 API가 특정 주소에 대해 반복 호출되는 것을 제한한다. */
@Component
public class EmailRequestRateLimiter {
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_REQUESTS = 3;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public EmailRequestRateLimiter(Clock clock) { this.clock = clock; }

    public void check(String action, String email) {
        String key = action + ":" + Member.normalizeEmail(email);
        Instant now = clock.instant();
        Window window = windows.compute(key, (ignored, existing) -> {
            if (existing == null || !existing.startedAt.plus(WINDOW).isAfter(now)) return new Window(now, 1);
            if (existing.count >= MAX_REQUESTS) throw tooManyRequests(existing.startedAt.plus(WINDOW), now);
            return new Window(existing.startedAt, existing.count + 1);
        });
        if (windows.size() > 10_000) windows.entrySet().removeIf(entry -> !entry.getValue().startedAt.plus(WINDOW).isAfter(now));
    }

    private MemberApiException tooManyRequests(Instant retryAt, Instant now) {
        long seconds = Math.max(1, Duration.between(now, retryAt).toSeconds());
        return new MemberApiException(HttpStatus.TOO_MANY_REQUESTS, "EMAIL_REQUEST_RATE_LIMITED", "요청이 많습니다. 약 " + seconds / 60 + "분 후 다시 시도해주세요.");
    }

    private record Window(Instant startedAt, int count) { }
}
