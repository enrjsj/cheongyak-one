package com.cheongyakone.api.member;

import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.application.member.MemberAccountRecoveryService;
import com.cheongyakone.application.member.SessionTokenCodec;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final MemberService memberService;
    private final SessionCookieSupport cookieSupport;
    private final SessionTokenCodec tokenCodec;
    private final Clock clock;
    private final MemberAccountRecoveryService accountRecoveryService;

    public AuthController(
            MemberService memberService,
            SessionCookieSupport cookieSupport,
            SessionTokenCodec tokenCodec,
            Clock clock,
            MemberAccountRecoveryService accountRecoveryService
    ) {
        this.memberService = memberService;
        this.cookieSupport = cookieSupport;
        this.tokenCodec = tokenCodec;
        this.clock = clock;
        this.accountRecoveryService = accountRecoveryService;
    }

    @PostMapping("/signup")
    public ResponseEntity<MemberResponse> signup(@Valid @RequestBody MemberRequests.Signup request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(memberService.signup(request));
    }

    @PostMapping("/login")
    public ResponseEntity<MemberResponse> login(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.Login request
    ) {
        MemberService.LoginResult result = memberService.login(request, servletRequest.getHeader(HttpHeaders.USER_AGENT));
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        cookieSupport.create(result.rawToken(), result.expiresAt(), clock.instant()).toString(),
                        cookieSupport.createCsrf(
                                tokenCodec.csrfToken(result.rawToken()),
                                result.expiresAt(),
                                clock.instant()
                        ).toString()
                )
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(result.member());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        memberService.logout(cookieSupport.read(request));
        return ResponseEntity.noContent()
                .header(
                        HttpHeaders.SET_COOKIE,
                        cookieSupport.clear().toString(),
                        cookieSupport.clearCsrf().toString()
                )
                .build();
    }

    @PostMapping("/email-verification/request")
    public ResponseEntity<Void> requestEmailVerification(
            @Valid @RequestBody MemberRequests.EmailRequest request
    ) {
        accountRecoveryService.requestEmailVerification(request.email());
        return accepted();
    }

    @PostMapping("/email-verification/confirm")
    public ResponseEntity<Void> confirmEmailVerification(
            @Valid @RequestBody MemberRequests.TokenRequest request
    ) {
        accountRecoveryService.confirmEmailVerification(request.token());
        return ResponseEntity.noContent().header(HttpHeaders.CACHE_CONTROL, "no-store").build();
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<Void> requestPasswordReset(
            @Valid @RequestBody MemberRequests.EmailRequest request
    ) {
        accountRecoveryService.requestPasswordReset(request.email());
        return accepted();
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> resetPassword(
            @Valid @RequestBody MemberRequests.ResetPassword request
    ) {
        accountRecoveryService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.noContent().header(HttpHeaders.CACHE_CONTROL, "no-store").build();
    }

    private ResponseEntity<Void> accepted() {
        // 가입 여부를 노출하지 않도록 존재하지 않는 이메일도 동일하게 응답한다.
        return ResponseEntity.accepted().header(HttpHeaders.CACHE_CONTROL, "no-store").build();
    }
}
