package com.cheongyakone.api.member;

import com.cheongyakone.config.AuthProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;

@Component
public class SessionCookieSupport {

    private final AuthProperties properties;

    public SessionCookieSupport(AuthProperties properties) {
        this.properties = properties;
    }

    public String read(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> properties.cookieName().equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    public ResponseCookie create(String rawToken, Instant expiresAt, Instant now) {
        Duration maxAge = Duration.between(now, expiresAt);
        return sessionCookie(rawToken).maxAge(maxAge).build();
    }

    public ResponseCookie clear() {
        return sessionCookie("").maxAge(Duration.ZERO).build();
    }

    public ResponseCookie createCsrf(String csrfToken, Instant expiresAt, Instant now) {
        return csrfCookie(csrfToken).maxAge(Duration.between(now, expiresAt)).build();
    }

    public ResponseCookie clearCsrf() {
        return csrfCookie("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder sessionCookie(String value) {
        // JavaScript에서 세션을 읽지 못하게 하고 동일 사이트 요청에만 전달한다.
        return ResponseCookie.from(properties.cookieName(), value)
                .httpOnly(true)
                .secure(properties.secureCookie())
                .sameSite("Lax")
                .path("/");
    }

    private ResponseCookie.ResponseCookieBuilder csrfCookie(String value) {
        // 이 쿠키와 동일한 값을 요청 헤더로도 보내야 상태 변경이 허용된다.
        return ResponseCookie.from(properties.csrfCookieName(), value)
                .httpOnly(false)
                .secure(properties.secureCookie())
                .sameSite("Lax")
                .path("/");
    }
}
