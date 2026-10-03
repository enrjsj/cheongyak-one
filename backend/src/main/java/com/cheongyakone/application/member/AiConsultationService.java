package com.cheongyakone.application.member;

import com.cheongyakone.application.NoticeQueryService;
import com.cheongyakone.config.AiConsultationProperties;
import com.cheongyakone.infrastructure.ai.OpenAiConsultationClient;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;

@Service
public class AiConsultationService {
    private final MemberService members;
    private final NoticeQueryService notices;
    private final AiConsultationProperties properties;
    private final OpenAiConsultationClient client;
    private final AiConsultationLimiter limiter;
    private final ObjectMapper mapper;
    private final Clock clock;

    public AiConsultationService(MemberService members, NoticeQueryService notices,
            AiConsultationProperties properties, OpenAiConsultationClient client,
            AiConsultationLimiter limiter, ObjectMapper mapper, Clock clock) {
        this.members = members; this.notices = notices; this.properties = properties;
        this.client = client; this.limiter = limiter; this.mapper = mapper; this.clock = clock;
    }

    public boolean available(String token) {
        members.requireMember(token);
        return properties.enabled();
    }

    public Result consult(String token, Long noticeId, Topic topic, boolean consent) {
        var member = members.requireMember(token);
        if (!consent) throw new MemberApiException(HttpStatus.BAD_REQUEST, "AI_CONSENT_REQUIRED",
                "공고 정보의 OpenAI 전송 안내에 동의해주세요.");
        if (!properties.enabled()) throw new MemberApiException(HttpStatus.SERVICE_UNAVAILABLE,
                "AI_NOT_CONFIGURED", "AI 상담 연결을 준비 중입니다.");
        var notice = notices.findById(noticeId);
        // Only public notice facts and a fixed topic leave our server; no member profile or identifiers.
        var input = new LinkedHashMap<String, Object>();
        input.put("topic", topic.label);
        input.put("title", notice.title());
        input.put("category", notice.housingCategory());
        input.put("region", notice.regionCode());
        input.put("applyStartDate", notice.applyStartDate());
        input.put("applyEndDate", notice.applyEndDate());
        input.put("syncedAt", notice.syncedAt());
        input.put("today", java.time.LocalDate.now(clock));
        limiter.acquire(member.getId());
        try {
            return new Result(noticeId, topic, client.consult(mapper.writeValueAsString(input)),
                    notice.officialUrl(), notice.syncedAt(), clock.instant(),
                    "AI 답변은 오류가 있을 수 있으며 청약 자격 판정·금융 조언이 아닙니다. 최종 판단은 공식 공고문과 담당 기관에서 확인하세요.");
        } finally { limiter.release(); }
    }

    public enum Topic {
        ELIGIBILITY("신청 자격 확인 항목"), CASH("필요 현금 확인 항목"), SCORE("청약 가점 확인 항목");
        final String label;
        Topic(String label) { this.label = label; }
    }
    public record Result(Long noticeId, Topic topic, String answer, String officialUrl,
                         Instant noticeSyncedAt, Instant generatedAt, String disclaimer) {}
}
