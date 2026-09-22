package com.cheongyakone.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduledNoticeSyncPropertiesTest {

    @Test
    void acceptsOnlyTheConfiguredKeyWhenEnabled() {
        ScheduledNoticeSyncProperties properties = new ScheduledNoticeSyncProperties(true, "scheduled-secret");

        assertThat(properties.isConfigured()).isTrue();
        assertThat(properties.accepts("scheduled-secret")).isTrue();
        assertThat(properties.accepts("wrong-secret")).isFalse();
        assertThat(properties.accepts(null)).isFalse();
    }

    @Test
    void remainsDisabledWithoutAnExplicitKey() {
        ScheduledNoticeSyncProperties disabled = new ScheduledNoticeSyncProperties(false, "scheduled-secret");
        ScheduledNoticeSyncProperties missingKey = new ScheduledNoticeSyncProperties(true, " ");

        assertThat(disabled.accepts("scheduled-secret")).isFalse();
        assertThat(missingKey.isConfigured()).isFalse();
        assertThat(missingKey.accepts("scheduled-secret")).isFalse();
    }
}
