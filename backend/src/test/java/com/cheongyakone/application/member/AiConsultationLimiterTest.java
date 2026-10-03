package com.cheongyakone.application.member;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiConsultationLimiterTest {
    @Test void limitsMemberThenExpiresWindow() {
        Clock clock = mock(Clock.class);
        Instant now = Instant.parse("2026-10-03T00:00:00Z");
        when(clock.instant()).thenReturn(now);
        var limiter = new AiConsultationLimiter(clock);
        for (int i = 0; i < 3; i++) { limiter.acquire(1L); limiter.release(); }
        assertThatThrownBy(() -> limiter.acquire(1L)).isInstanceOf(MemberApiException.class);
        when(clock.instant()).thenReturn(now.plusSeconds(900));
        assertThatCode(() -> limiter.acquire(1L)).doesNotThrowAnyException();
    }
    @Test void limitsConcurrentCallsAndReleasesSlot() {
        var limiter = new AiConsultationLimiter(Clock.systemUTC());
        limiter.acquire(1L); limiter.acquire(2L);
        assertThatThrownBy(() -> limiter.acquire(3L)).isInstanceOf(MemberApiException.class);
        limiter.release();
        assertThatCode(() -> limiter.acquire(3L)).doesNotThrowAnyException();
    }
    @Test void limitsTotalInstanceCost() {
        var limiter = new AiConsultationLimiter(Clock.systemUTC());
        for (long i = 0; i < 100; i++) { limiter.acquire(i); limiter.release(); }
        assertThatThrownBy(() -> limiter.acquire(101L)).isInstanceOf(MemberApiException.class);
    }
}
