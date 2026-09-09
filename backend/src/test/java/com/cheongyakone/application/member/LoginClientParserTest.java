package com.cheongyakone.application.member;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginClientParserTest {

    private final LoginClientParser parser = new LoginClientParser();

    @Test
    void identifiesCommonBrowsersAndOperatingSystems() {
        assertThat(parser.parse(
                "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0"
        )).isEqualTo("Edge · Windows");
        assertThat(parser.parse(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
        )).isEqualTo("Safari · iPhone");
        assertThat(parser.parse(null)).isEqualTo("알 수 없는 기기");
        assertThat(parser.parse("custom-client")).isEqualTo("알 수 없는 기기");
    }
}
