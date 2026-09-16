package com.cheongyakone.config;

// 세션 쿠키를 사용하는 회원 API의 상태 변경 요청에 CSRF 검증을 연결한다.

import com.cheongyakone.api.member.CsrfProtectionInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ApiSecurityConfig implements WebMvcConfigurer {

    private final CsrfProtectionInterceptor csrfProtectionInterceptor;

    public ApiSecurityConfig(CsrfProtectionInterceptor csrfProtectionInterceptor) {
        this.csrfProtectionInterceptor = csrfProtectionInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(csrfProtectionInterceptor)
                .addPathPatterns("/api/v1/members/**", "/api/v1/admin/**", "/api/v1/auth/logout");
    }
}
