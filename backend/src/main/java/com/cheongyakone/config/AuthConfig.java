package com.cheongyakone.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AuthConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        // BCrypt 강도 12는 계정 기능의 초기 규모에서 보안성과 응답 시간을 균형 있게 맞춘다.
        return new BCryptPasswordEncoder(12);
    }
}
