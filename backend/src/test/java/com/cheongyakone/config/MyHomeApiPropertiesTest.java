package com.cheongyakone.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MyHomeApiPropertiesTest {

    @Test
    void normalizesEnvAssignmentAndSupportsAnOptionalKey() {
        MyHomeApiProperties configured = new MyHomeApiProperties(
                null,
                "MYHOME_API_KEY='abc%2Bdef%2Fghi%3D'\n",
                0,
                0
        );
        MyHomeApiProperties missing = new MyHomeApiProperties(null, "", 0, 0);

        assertThat(configured.configured()).isTrue();
        assertThat(configured.serviceKey()).isEqualTo("abc%2Bdef%2Fghi%3D");
        assertThat(configured.decodedServiceKey()).isEqualTo("abc+def/ghi=");
        assertThat(missing.configured()).isFalse();
    }
}
