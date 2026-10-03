package com.cheongyakone.application.member;

import com.cheongyakone.api.admin.AdminAiConsultationController;
import com.cheongyakone.api.member.SessionCookieSupport;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpStatus;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class AdminAiUsageAccessTest {
    @Test void rejectsUnauthorizedBeforeReadingUsage() {
        var members = mock(MemberService.class);
        var cookies = mock(SessionCookieSupport.class);
        var usage = mock(AiConsultationLimiter.class);
        var request = new MockHttpServletRequest();
        when(cookies.read(request)).thenReturn("session");
        when(members.requireAdmin("session")).thenThrow(new MemberApiException(HttpStatus.FORBIDDEN, "ADMIN", "관리자 권한 필요"));
        assertThatThrownBy(() -> new AdminAiConsultationController(members, cookies, usage).usage(request))
                .isInstanceOf(MemberApiException.class);
        verifyNoInteractions(usage);
    }
    @Test void adminCanReadAggregateUsage() {
        var members = mock(MemberService.class);
        var cookies = mock(SessionCookieSupport.class);
        var usage = mock(AiConsultationLimiter.class);
        var request = new MockHttpServletRequest();
        when(cookies.read(request)).thenReturn("admin");
        when(usage.recentUsage()).thenReturn(List.of());
        assertThat(new AdminAiConsultationController(members, cookies, usage).usage(request)).isEmpty();
        verify(members).requireAdmin("admin");
        verify(usage).recentUsage();
    }
}
