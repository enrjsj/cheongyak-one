package com.cheongyakone.application.member;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

@Component
public class SessionTokenCodec {

    private static final int TOKEN_BYTES = 32;
    private static final String CSRF_DOMAIN_SEPARATOR = "csrf:";
    private final SecureRandom secureRandom = new SecureRandom();

    public String createRawToken() {
        byte[] token = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(token);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(token);
    }

    public String hash(String rawToken) {
        // 유출된 DB만으로 인증할 수 없도록 세션·일회용 토큰 원문 대신 단방향 해시만 저장한다.
        return HexFormat.of().formatHex(digest(rawToken));
    }

    public String csrfToken(String rawToken) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(digest(CSRF_DOMAIN_SEPARATOR + rawToken));
    }

    public boolean csrfTokenMatches(String rawToken, String suppliedToken) {
        if (rawToken == null || rawToken.isBlank() || suppliedToken == null || suppliedToken.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                csrfToken(rawToken).getBytes(StandardCharsets.UTF_8),
                suppliedToken.getBytes(StandardCharsets.UTF_8)
        );
    }

    private byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
