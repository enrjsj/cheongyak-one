package com.cheongyakone.api.member;

import com.cheongyakone.application.member.MemberApiException;
import com.cheongyakone.application.member.SessionTokenCodec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Set;

@Component
public class CsrfProtectionInterceptor implements HandlerInterceptor {

    public static final String CSRF_HEADER = "X-CSRF-Token";
    private static final Set<String> SAFE_METHODS = Set.of(
            HttpMethod.GET.name(),
            HttpMethod.HEAD.name(),
            HttpMethod.OPTIONS.name()
    );

    private final SessionCookieSupport cookieSupport;
    private final SessionTokenCodec tokenCodec;

    public CsrfProtectionInterceptor(SessionCookieSupport cookieSupport, SessionTokenCodec tokenCodec) {
        this.cookieSupport = cookieSupport;
        this.tokenCodec = tokenCodec;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if (SAFE_METHODS.contains(request.getMethod())) {
            return true;
        }

        String rawSession = cookieSupport.read(request);
        // 세션이 없는 요청은 서비스 계층에서 기존과 같이 401로 처리한다.
        if (rawSession == null || rawSession.isBlank()) {
            return true;
        }
        if (!tokenCodec.csrfTokenMatches(rawSession, request.getHeader(CSRF_HEADER))) {
            throw new MemberApiException(
                    HttpStatus.FORBIDDEN,
                    "CSRF_TOKEN_INVALID",
                    "보안 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해주세요."
            );
        }
        return true;
    }
}
