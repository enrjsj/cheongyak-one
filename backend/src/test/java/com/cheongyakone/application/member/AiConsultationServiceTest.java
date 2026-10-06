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
        when(limiter.acquire(eq(42L), eq("test-model"), anyInt())).thenReturn("attempt");
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
        verify(limiter).acquire(eq(42L), eq("test-model"), anyInt());
        verify(limiter).finish(eq("attempt"), any(), any(AiProviderResult.Failure.class));
        verify(member, never()).getEmail();
    }
    @Test void rejectedAnswerCountsAsFailureAndIsNotReturned() {
        var member = mock(Member.class);
        when(member.getId()).thenReturn(42L);
        when(members.requireMember("session")).thenReturn(member);
        when(limiter.acquire(eq(42L), eq("test-model"), anyInt())).thenReturn("attempt");
        when(notices.findById(1L)).thenReturn(JsonMapper.builder().build()
                .readValue("{\"id\":1,\"title\":\"공개 공고\"}", NoticeDetailResponse.class));
        when(client.consult(anyString())).thenReturn(new AiProviderResult("신청 가능합니다.", "test-model", null));
        assertThatThrownBy(() -> service(true).consult("session", 1L, AiConsultationService.Topic.ELIGIBILITY, true))
                .isInstanceOf(MemberApiException.class);
        verify(limiter).finish(eq("attempt"), any(), any(AiProviderResult.Failure.class));
    }
    @Test void checklistAnswerCompletesUsageSuccessfully() {
        var member = mock(Member.class);
        when(member.getId()).thenReturn(42L);
        when(members.requireMember("session")).thenReturn(member);
        when(limiter.acquire(eq(42L), eq("test-model"), anyInt())).thenReturn("attempt");
        when(notices.findById(1L)).thenReturn(JsonMapper.builder().build()
                .readValue("{\"id\":1,\"title\":\"공개 공고\"}", NoticeDetailResponse.class));
        when(client.consult(anyString())).thenReturn(new AiProviderResult("[F1] 공식 공고에서 거주지 요건을 확인하세요.", "test-model", new AiProviderResult.Usage(100, 0, 30)));
        assertThat(service(true).consult("session", 1L, AiConsultationService.Topic.ELIGIBILITY, true).answer())
                .contains("거주지");
        verify(limiter).finish(eq("attempt"), any(AiProviderResult.class), isNull());
    }
    @Test void budgetRefusalNeverCallsProvider() {
        var member = mock(Member.class);
        when(member.getId()).thenReturn(42L);
        when(members.requireMember("session")).thenReturn(member);
        when(notices.findById(1L)).thenReturn(JsonMapper.builder().build().readValue("{\"id\":1,\"title\":\"공개 공고\"}", NoticeDetailResponse.class));
        when(limiter.acquire(eq(42L), eq("test-model"), anyInt())).thenThrow(new MemberApiException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS, "AI_BUDGET_EXCEEDED", "budget"));
        assertThatThrownBy(() -> service(true).consult("session", 1L, AiConsultationService.Topic.CASH, true)).isInstanceOf(MemberApiException.class);
        verifyNoInteractions(client);
    }
}
