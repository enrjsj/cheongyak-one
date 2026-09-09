package com.cheongyakone.config;

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
