package com.cheongyakone.infrastructure.kakao;

import com.cheongyakone.config.KakaoSelfProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;

@Component
public class KakaoSelfClient {
    private final KakaoSelfProperties properties;
    private final RestClient client;
    @Autowired public KakaoSelfClient(KakaoSelfProperties properties) { this(properties, builder()); }
    KakaoSelfClient(KakaoSelfProperties properties, RestClient.Builder builder) {
        this.properties = properties; this.client = builder.build();
    }
    private static RestClient.Builder builder() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(8));
        return RestClient.builder().requestFactory(factory);
    }
    public Tokens exchange(String code) { return token("authorization_code", "code", code); }
    public Tokens refresh(String refreshToken) { return token("refresh_token", "refresh_token", refreshToken); }
    private Tokens token(String grant, String field, String value) {
        if (!properties.enabled()) throw new Failure("DISABLED");
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", grant); form.add("client_id", properties.restApiKey()); form.add(field, value);
        if (!properties.clientSecret().isEmpty()) form.add("client_secret", properties.clientSecret());
        if (grant.equals("authorization_code")) form.add("redirect_uri", properties.redirectUri());
        try {
            JsonNode body = client.post().uri("https://kauth.kakao.com/oauth/token").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form).retrieve().body(JsonNode.class);
            if (body == null || body.path("access_token").asText().isBlank() || body.path("expires_in").asLong() <= 0) throw new Failure("INVALID_RESPONSE");
            String refresh = body.path("refresh_token").asText("");
            if (grant.equals("authorization_code") && (refresh.isBlank() || body.path("refresh_token_expires_in").asLong() <= 0
                    || !Arrays.asList(body.path("scope").asText("").split("[ ,]+" )).contains("talk_message"))) throw new Failure("RECONNECT_REQUIRED");
            if (!refresh.isBlank() && body.path("refresh_token_expires_in").asLong() <= 0) throw new Failure("INVALID_RESPONSE");
            return new Tokens(body.path("access_token").asText(), body.path("expires_in").asLong(), refresh,
                    body.path("refresh_token_expires_in").asLong());
        } catch (Failure failure) { throw failure; }
        catch (RestClientResponseException exception) {
            throw new Failure(exception.getStatusCode().is4xxClientError() && exception.getStatusCode().value() != 429 ? "RECONNECT_REQUIRED" : "PROVIDER_UNAVAILABLE");
        } catch (RuntimeException exception) { throw new Failure("PROVIDER_UNAVAILABLE"); }
    }
    public void send(String accessToken, String text, String url) {
        if (!properties.enabled()) throw new Failure("DISABLED");
        var form = new LinkedMultiValueMap<String, String>();
        form.add("template_object", JsonMapper.builder().build().writeValueAsString(Map.of("object_type", "text", "text", text,
                "link", Map.of("web_url", url, "mobile_web_url", url), "button_title", "공고 확인")));
        try {
            JsonNode response = client.post().uri("https://kapi.kakao.com/v2/api/talk/memo/default/send")
                    .header("Authorization", "Bearer " + accessToken).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form).retrieve().body(JsonNode.class);
            if (response == null || !response.path("result_code").isIntegralNumber() || response.path("result_code").asInt() != 0) throw new Failure("UNKNOWN");
        } catch (Failure failure) { throw failure; }
        catch (RestClientResponseException exception) {
            int status = exception.getStatusCode().value();
            throw new Failure(status == 401 || status == 403 ? "RECONNECT_REQUIRED" : status == 429 ? "RATE_LIMITED" : status >= 500 ? "UNKNOWN" : "REJECTED");
        } catch (RuntimeException exception) { throw new Failure("UNKNOWN"); }
    }
    public record Tokens(String accessToken, long expiresIn, String refreshToken, long refreshExpiresIn) {
        @Override public String toString() { return "KakaoTokens[redacted]"; }
    }
    public static class Failure extends RuntimeException {
        private final String outcome;
        public Failure(String outcome) { super("Kakao request did not complete: " + outcome); this.outcome = outcome; }
        public String outcome() { return outcome; }
    }
}
