package com.cheongyakone.infrastructure.kakao;

import com.cheongyakone.config.KakaoSelfProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import java.util.Base64;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class KakaoSelfClientTest {
    static KakaoSelfProperties properties() { return new KakaoSelfProperties(true,1L,"test-key","test-secret",
            "https://example.com/api/v1/members/me/kakao-self/callback","https://example.com", Base64.getEncoder().encodeToString(new byte[32])); }
    final RestClient.Builder builder=RestClient.builder();
    final MockRestServiceServer server=MockRestServiceServer.bindTo(builder).build();
    final KakaoSelfClient client=new KakaoSelfClient(properties(),builder);
    @Test void exchangesFormEncodedCodeAndRequiresMessageConsent() {
        server.expect(requestTo("https://kauth.kakao.com/oauth/token"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("code=code%2Bvalue")))
                .andRespond(withSuccess("{\"access_token\":\"access\",\"refresh_token\":\"refresh\",\"expires_in\":100,\"refresh_token_expires_in\":10000,\"scope\":\"talk_message\"}",MediaType.APPLICATION_JSON));
        assertThat(client.exchange("code+value").accessToken()).isEqualTo("access"); server.verify();
    }
    @Test void rejectsMissingTalkMessageConsent() {
        server.expect(anything()).andRespond(withSuccess("{\"access_token\":\"access\",\"refresh_token\":\"refresh\",\"expires_in\":100,\"refresh_token_expires_in\":10000,\"scope\":\"profile\"}",MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.exchange("code")).isInstanceOf(KakaoSelfClient.Failure.class).hasMessageContaining("RECONNECT_REQUIRED");
    }
    @Test void refreshMayOmitRefreshToken() {
        server.expect(requestTo("https://kauth.kakao.com/oauth/token")).andRespond(withSuccess("{\"access_token\":\"next\",\"expires_in\":300}",MediaType.APPLICATION_JSON));
        assertThat(client.refresh("refresh").refreshToken()).isEmpty();
    }
    @Test void sendsOnlyToMemoEndpointAndRequiresExplicitSuccess() {
        server.expect(requestTo("https://kapi.kakao.com/v2/api/talk/memo/default/send"))
                .andExpect(header("Authorization","Bearer access"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("template_object=")))
                .andRespond(withSuccess("{\"result_code\":0}",MediaType.APPLICATION_JSON));
        client.send("access","테스트","https://example.com"); server.verify();
    }
    @Test void ambiguousProviderFailureIsSanitized() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("secret-provider-payload"));
        assertThatThrownBy(() -> client.send("access","text","https://example.com"))
                .hasMessageContaining("UNKNOWN").hasMessageNotContaining("secret-provider-payload").hasMessageNotContaining("access");
    }
    @Test void timeoutIsUnknownAndAuthorizationFailureRequiresReconnect() {
        server.expect(anything()).andRespond(withException(new java.net.SocketTimeoutException("secret")));
        assertThatThrownBy(() -> client.send("access","text","https://example.com")).hasMessageContaining("UNKNOWN").hasMessageNotContaining("secret");
    }
    @Test void cryptoIsAuthenticatedRandomizedAndRedacted() {
        var cipher=new KakaoSelfTokenCipher(properties());
        String a=cipher.encrypt("token"), b=cipher.encrypt("token");
        assertThat(a).isNotEqualTo(b).doesNotContain("token");
        assertThat(cipher.decrypt(a)).isEqualTo("token");
        byte[] damaged=Base64.getDecoder().decode(a); damaged[damaged.length-1]^=1;
        assertThatThrownBy(() -> cipher.decrypt(Base64.getEncoder().encodeToString(damaged))).hasMessage("Kakao credentials require reconnection");
        assertThat(properties().toString()).doesNotContain("test-key","test-secret",properties().tokenEncryptionKey());
    }
    @Test void enabledConfigRejectsInvalidKeyCrossOriginAndNonHttps() {
        assertThatThrownBy(() -> new KakaoSelfProperties(true,1L,"key","","https://api.example.com/api/v1/members/me/kakao-self/callback","https://example.com",properties().tokenEncryptionKey())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new KakaoSelfProperties(true,1L,"key","","https://example.com/api/v1/members/me/kakao-self/callback","https://example.com","wrong-key")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new KakaoSelfProperties(true,1L,"key","","http://example.com/api/v1/members/me/kakao-self/callback","http://example.com",properties().tokenEncryptionKey())).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void disabledNeverCallsProvider() {
        var off=new KakaoSelfClient(new KakaoSelfProperties(false,null,"","","","",""),builder);
        assertThatThrownBy(() -> off.send("token","text","https://example.com")).hasMessageContaining("DISABLED"); server.verify();
    }
}
