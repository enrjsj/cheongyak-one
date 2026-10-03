package com.cheongyakone.application.member;

import com.cheongyakone.application.NoticeQueryService;
import com.cheongyakone.api.NoticeDetailResponse;
import com.cheongyakone.config.AiConsultationProperties;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.infrastructure.ai.OpenAiConsultationClient;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.time.Clock;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AiConsultationServiceTest {
    final MemberService members = mock(MemberService.class);
    final NoticeQueryService notices = mock(NoticeQueryService.class);
    final OpenAiConsultationClient client = mock(OpenAiConsultationClient.class);
    final AiConsultationLimiter limiter = mock(AiConsultationLimiter.class);
    AiConsultationService service(boolean enabled) {
        return new AiConsultationService(members, notices,
                new AiConsultationProperties(enabled, "test-key", "test-model"),
                client, limiter, JsonMapper.builder().build(), Clock.systemUTC());
    }
    @Test void requiresAuthenticationBeforeAnyProviderCall() {
        when(members.requireMember("bad")).thenThrow(new MemberApiException(
                org.springframework.http.HttpStatus.UNAUTHORIZED, "AUTH", "로그인 필요"));
        assertThatThrownBy(() -> service(true).consult("bad", 1L, AiConsultationService.Topic.CASH, true))
                .isInstanceOf(MemberApiException.class);
        verifyNoInteractions(client, notices, limiter);
    }
    @Test void requiresConsentAndConfiguredProvider() {
        assertThatThrownBy(() -> service(true).consult("token", 1L, AiConsultationService.Topic.CASH, false))
                .isInstanceOf(MemberApiException.class);
        assertThatThrownBy(() -> service(false).consult("token", 1L, AiConsultationService.Topic.CASH, true))
                .isInstanceOf(MemberApiException.class);
        verifyNoInteractions(client, notices, limiter);
    }
    @Test void sendsOnlyPublicFactsAndReleasesQuotaOnFailure() {
        var member = mock(Member.class);
        when(member.getId()).thenReturn(42L);
        when(members.requireMember("private-session")).thenReturn(member);
        var notice = JsonMapper.builder().build().readValue(
                "{\"id\":1,\"title\":\"공개 공고\"}", NoticeDetailResponse.class);
        when(notices.findById(1L)).thenReturn(notice);
        when(client.consult(anyString())).thenAnswer(invocation -> {
            String input = invocation.getArgument(0);
            assertThat(input).contains("공개 공고").doesNotContain("private-session", "memberId", "email");
            throw new IllegalStateException("simulated provider failure");
        });
        assertThatThrownBy(() -> service(true).consult("private-session", 1L, AiConsultationService.Topic.CASH, true))
                .isInstanceOf(IllegalStateException.class);
        verify(limiter).acquire(42L);
        verify(limiter).release();
        verify(member, never()).getEmail();
    }
}
