package com.cheongyakone.application.member;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Single-instance cost guard; deployment across replicas needs a shared quota store. */
@Component
public class AiConsultationLimiter {
    private final Clock clock;
    private final Map<Long, Window> members = new HashMap<>();
    private Window global;
    private int active;

    public AiConsultationLimiter(Clock clock) { this.clock = clock; }

    public synchronized void acquire(Long memberId) {
        Instant now = clock.instant();
        members.entrySet().removeIf(e -> !e.getValue().start().plus(Duration.ofMinutes(15)).isAfter(now));
        Window member = members.getOrDefault(memberId, new Window(now, 0));
        if (global == null || !global.start().plus(Duration.ofHours(1)).isAfter(now)) global = new Window(now, 0);
        if (active >= 2 || member.count() >= 3 || global.count() >= 100) {
            throw new MemberApiException(HttpStatus.TOO_MANY_REQUESTS, "AI_RATE_LIMITED",
                    "상담 요청이 많습니다. 잠시 후 다시 시도해주세요.");
        }
        members.put(memberId, new Window(member.start(), member.count() + 1));
        global = new Window(global.start(), global.count() + 1);
        active++;
    }

    public synchronized void release() { active = Math.max(0, active - 1); }
    private record Window(Instant start, int count) {}
}
