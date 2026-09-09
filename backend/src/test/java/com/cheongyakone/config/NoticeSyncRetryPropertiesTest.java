package com.cheongyakone.config;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class NoticeSyncRetryPropertiesTest {

    @Test
    void appliesSafeDefaultsAndUpperBounds() {
        NoticeSyncRetryProperties defaults = new NoticeSyncRetryProperties(0, null);
        NoticeSyncRetryProperties bounded = new NoticeSyncRetryProperties(99, Duration.ofMinutes(5));

        assertThat(defaults.maxAttempts()).isEqualTo(3);
        assertThat(defaults.delay()).isEqualTo(Duration.ofSeconds(2));
        assertThat(bounded.maxAttempts()).isEqualTo(5);
        assertThat(bounded.delay()).isEqualTo(Duration.ofMinutes(1));
    }
}
