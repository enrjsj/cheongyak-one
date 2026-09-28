package com.cheongyakone.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// Vercel 프런트와 Render API가 다른 출처일 때 인증 쿠키 요청을 허용한다.
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final CorsProperties properties;

    public CorsConfig(CorsProperties properties) {
        this.properties = properties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        var origins = properties.origins();
        if (origins.isEmpty()) {
            return;
        }
        registry.addMapping("/api/**")
                .allowedOrigins(origins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "Accept", "X-CSRF-Token")
                // Vercel과 Render는 서로 다른 출처다. 브라우저가 Set-Cookie 헤더를
                // 읽을 수 없으므로, CSRF 토큰만 허용된 프런트 출처에 응답 헤더로 노출한다.
                .exposedHeaders("X-CSRF-Token")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
