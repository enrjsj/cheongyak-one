package com.cheongyakone.infrastructure.ai;

import com.cheongyakone.config.AiConsultationProperties;
import com.cheongyakone.application.member.MemberApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class OpenAiConsultationClientTest {
    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final OpenAiConsultationClient client = new OpenAiConsultationClient(
            new AiConsultationProperties(true, "test-only-key", "test-model"), builder);

    @Test void sendsStatelessRequestAndReadsAllTextParts() {
        server.expect(requestTo("https://api.openai.com/v1/responses"))
                .andExpect(header("Authorization", "Bearer test-only-key"))
                .andExpect(jsonPath("$.store").value(false))
                .andExpect(jsonPath("$.model").value("test-model"))
                .andExpect(jsonPath("$.max_output_tokens").value(1600))
                .andExpect(jsonPath("$.input").value("public facts"))
                .andRespond(withSuccess("""
                        {"status":"completed","output":[
                          {"type":"reasoning","summary":[]},
                          {"type":"message","role":"assistant","content":[
                            {"type":"output_text","text":"첫 안내"},
                            {"type":"output_text","text":"다음 확인"}]}]}
                        """, MediaType.APPLICATION_JSON));
        assertThat(client.consult("public facts")).isEqualTo("첫 안내\n다음 확인");
        server.verify();
    }
    @Test void rejectsIncompleteOutput() {
        server.expect(anything()).andRespond(withSuccess(
                "{\"status\":\"incomplete\",\"output\":[]}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.consult("facts")).isInstanceOf(MemberApiException.class);
    }
    @Test void rejectsEmptyCompletedOutput() {
        server.expect(anything()).andRespond(withSuccess(
                "{\"status\":\"completed\",\"output\":[]}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.consult("facts")).isInstanceOf(MemberApiException.class);
    }
    @Test void sanitizesProviderError() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .body("sensitive-provider-payload"));
        assertThatThrownBy(() -> client.consult("facts"))
                .isInstanceOf(MemberApiException.class)
                .hasMessageNotContaining("sensitive-provider-payload")
                .hasMessageNotContaining("test-only-key");
    }
    @Test void disabledClientNeverCallsProvider() {
        var disabled = new OpenAiConsultationClient(new AiConsultationProperties(false, "", ""), builder);
        assertThatThrownBy(() -> disabled.consult("facts")).isInstanceOf(MemberApiException.class);
        server.verify();
    }
    @Test void credentialsAreNeverPrintedAndEnabledConfigRequiresModel() {
        assertThat(new AiConsultationProperties(true, "secret", "model").toString()).doesNotContain("secret");
        assertThatThrownBy(() -> new AiConsultationProperties(true, "secret", ""))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
