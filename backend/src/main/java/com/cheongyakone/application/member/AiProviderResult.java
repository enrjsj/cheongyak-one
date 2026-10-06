package com.cheongyakone.application.member;

/** Content remains request-local; only usage metadata is persisted. */
public record AiProviderResult(String answer, String model, Usage usage) {
    @Override public String toString() { return "AiProviderResult[model=" + model + ", usage=" + usage + "]"; }
    public record Usage(long inputTokens, long cachedInputTokens, long outputTokens) {
        public Usage {
            if (inputTokens < 0 || cachedInputTokens < 0 || outputTokens < 0 || cachedInputTokens > inputTokens
                    || inputTokens > 10000000 || outputTokens > 10000000) throw new IllegalArgumentException("Invalid token usage");
        }
    }
    public enum Failure { PROVIDER_AUTH, PROVIDER_RATE_LIMIT, PROVIDER_ERROR, TIMEOUT, TRANSPORT,
        INCOMPLETE, REFUSAL, INVALID_RESPONSE, ANSWER_REJECTED, INTERNAL, LEASE_EXPIRED }
    public static class ProviderException extends MemberApiException {
        private final Failure failure;
        private final AiProviderResult result;
        public ProviderException(Failure failure, AiProviderResult result) {
            super(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE",
                    "AI 상담을 지금 제공할 수 없습니다. 잠시 후 다시 시도하거나 공식 공고를 확인해주세요.");
            this.failure = failure; this.result = result;
        }
        public Failure failure() { return failure; }
        public AiProviderResult result() { return result; }
    }
}
