package com.cheongyakone.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RebApiPropertiesTest {

    @Test
    void normalizesEnvAssignmentAndQuotes() {
        RebApiProperties properties = new RebApiProperties(
                null,
                "REB_API_KEY=\"abc%2Bdef%2Fghi%3D\"\n",
                0,
                0
        );

        assertThat(properties.configured()).isTrue();
        assertThat(properties.serviceKey()).isEqualTo("abc%2Bdef%2Fghi%3D");
        assertThat(properties.decodedServiceKey()).isEqualTo("abc+def/ghi=");
    }
}
