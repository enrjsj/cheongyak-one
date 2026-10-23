package com.cheongyakone.api.member;

import com.cheongyakone.application.member.KakaoSelfService;
import com.cheongyakone.config.KakaoSelfProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/members/me/kakao-self")
public class KakaoSelfController {
    private final KakaoSelfService service;
    private final SessionCookieSupport cookies;
    private final KakaoSelfProperties properties;
    public KakaoSelfController(KakaoSelfService service, SessionCookieSupport cookies, KakaoSelfProperties properties) {
        this.service=service; this.cookies=cookies; this.properties=properties;
    }
    @GetMapping public KakaoSelfService.Status status(HttpServletRequest request) { return service.status(cookies.read(request)); }
    @PostMapping("/authorize") public Map<String,String> authorize(HttpServletRequest request) { return Map.of("authorizationUrl",service.authorize(cookies.read(request))); }
    @GetMapping("/callback") public ResponseEntity<Void> callback(HttpServletRequest request,
            @RequestParam(required=false) String state, @RequestParam(required=false) String code, @RequestParam(required=false) String error) {
        String outcome=service.callback(cookies.read(request),state,code,error);
        // Fixed destination only. Clear the code from the address bar without reflecting provider input.
        String front=properties.frontendBaseUrl().isBlank() ? "" : properties.frontendBaseUrl();
        return ResponseEntity.status(303).location(URI.create(front + "/?kakaoSelf=" + outcome))
                .header(HttpHeaders.CACHE_CONTROL,"no-store").header("Referrer-Policy","no-referrer").build();
    }
    @DeleteMapping public ResponseEntity<Void> disconnect(HttpServletRequest request) { service.disconnect(cookies.read(request)); return ResponseEntity.noContent().build(); }
    @PostMapping("/test") public KakaoSelfService.Status test(HttpServletRequest request) { return service.test(cookies.read(request)); }
}
