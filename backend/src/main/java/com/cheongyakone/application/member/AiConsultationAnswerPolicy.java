package com.cheongyakone.application.member;

import org.springframework.http.HttpStatus;
import java.text.Normalizer;
import java.util.regex.Pattern;

/** Conservative lexical guard, not a factual or semantic verifier. Real-model evaluation is still required. */
public final class AiConsultationAnswerPolicy {
    private AiConsultationAnswerPolicy() {}
    private static final Pattern UNSUPPORTED_NUMBER = Pattern.compile(
            "(?:[0-9][0-9,.]*|[일이삼사오육칠팔구십백천]+)\\s*(?:억\\s*원|만\\s*원|원|점|%|퍼센트)");
    private static final Pattern VERDICT = Pattern.compile(
            "(?:신청|청약|당첨|대출|자격)\\s*(?:이|은|는|을|가)?\\s*(?:가능합니다|불가능합니다|확정|보장|충족합니다)|당첨\\s*확률");
    public static String check(String answer) {
        String normalized = answer == null ? "" : Normalizer.normalize(answer, Normalizer.Form.NFKC)
                .replaceAll("[\\p{Cf}]", "");
        if (normalized.isBlank() || normalized.length() > 12000
                || UNSUPPORTED_NUMBER.matcher(normalized).find() || VERDICT.matcher(normalized).find()
                || Pattern.compile("https?://|www\\.", Pattern.CASE_INSENSITIVE).matcher(normalized).find()) {
            throw new MemberApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_ANSWER_REJECTED",
                    "답변의 안전성을 확인하지 못했습니다. 공식 공고문을 확인하거나 잠시 후 다시 시도해주세요.");
        }
        return answer;
    }
}
