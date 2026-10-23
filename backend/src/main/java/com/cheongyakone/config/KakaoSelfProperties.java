package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.net.URI;
import java.util.Base64;

@ConfigurationProperties("app.kakao-self")
public record KakaoSelfProperties(boolean enabled, Long ownerMemberId, String restApiKey,
        String clientSecret, String redirectUri, String frontendBaseUrl, String tokenEncryptionKey) {
    public KakaoSelfProperties {
        restApiKey = clean(restApiKey); clientSecret = clean(clientSecret);
        redirectUri = clean(redirectUri); tokenEncryptionKey = clean(tokenEncryptionKey);
        frontendBaseUrl = clean(frontendBaseUrl).replaceAll("/+$", "");
        if (enabled) {
            if (ownerMemberId == null || ownerMemberId <= 0 || restApiKey.isEmpty()) invalid();
            try {
                URI front = URI.create(frontendBaseUrl), callback = URI.create(redirectUri);
                if (!validOrigin(front) || !validOrigin(callback)
                        || !front.resolve("/").equals(callback.resolve("/"))
                        || !(front.getPath().isEmpty() || front.getPath().equals("/"))
                        || !callback.getPath().equals("/api/v1/members/me/kakao-self/callback")
                        || Base64.getDecoder().decode(tokenEncryptionKey).length != 32) invalid();
            } catch (IllegalArgumentException exception) { invalid(); }
        }
    }
    private static boolean validOrigin(URI uri) {
        return uri.getHost() != null && uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null
                && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())
                && ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost())));
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static void invalid() { throw new IllegalArgumentException("Kakao self configuration is incomplete or invalid"); }
    @Override public String toString() { return "KakaoSelfProperties[enabled=" + enabled + "]"; }
}
