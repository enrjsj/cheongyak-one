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
        assertThat(client.consult("public facts").answer()).isEqualTo("첫 안내\n다음 확인");
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

    @Test void capturesTokensIncludingCachedInputAndModelWithoutProviderIdentifiers() {
        server.expect(anything()).andRespond(withSuccess("""
            {"id":"private-provider-id","model":"test-model-v2","status":"completed",
             "usage":{"input_tokens":1000,"input_tokens_details":{"cached_tokens":200},"output_tokens":100},
             "output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"[F1] 확인하세요."}]}]}
            """, MediaType.APPLICATION_JSON));
        var result = client.consult("facts");
        assertThat(result.model()).isEqualTo("test-model-v2");
        assertThat(result.usage().inputTokens()).isEqualTo(1000);
        assertThat(result.usage().cachedInputTokens()).isEqualTo(200);
        assertThat(result.usage().outputTokens()).isEqualTo(100);
        assertThat(result.toString()).doesNotContain("private-provider-id");
    }
    @Test void incompleteBillableResponseRetainsUsageForCostAccounting() {
        server.expect(anything()).andRespond(withSuccess("""
            {"model":"test-model","status":"incomplete","usage":{"input_tokens":100,"input_tokens_details":{"cached_tokens":0},"output_tokens":1600}}
            """, MediaType.APPLICATION_JSON));
        var failure = catchThrowableOfType(() -> client.consult("facts"), com.cheongyakone.application.member.AiProviderResult.ProviderException.class);
        assertThat(failure.failure()).isEqualTo(com.cheongyakone.application.member.AiProviderResult.Failure.INCOMPLETE);
        assertThat(failure.result().usage().outputTokens()).isEqualTo(1600);
    }
    @Test void malformedUsageIsUnknownRatherThanFree() {
        server.expect(anything()).andRespond(withSuccess("""
            {"status":"completed","usage":{"input_tokens":10,"input_tokens_details":{"cached_tokens":99},"output_tokens":1},
             "output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"[F1] 확인하세요."}]}]}
            """, MediaType.APPLICATION_JSON));
        assertThat(client.consult("facts").usage()).isNull();
    }
    @Test void oversizedContextNeverReachesProvider() {
        assertThatThrownBy(() -> client.consult("가".repeat(12000))).isInstanceOf(MemberApiException.class);
        server.verify();
    }
}
