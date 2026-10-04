package com.cheongyakone.application.member;

import com.cheongyakone.api.admin.AdminPushNotificationController;
import com.cheongyakone.api.member.SessionCookieSupport;
import com.cheongyakone.application.admin.AdminPushNotificationService;
import com.cheongyakone.domain.member.MemberDeviceTokenRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import java.time.Clock;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminPushDispatchSummaryTest {
    @Test void unauthorizedCannotStartDetailedDispatch() {
        var members = mock(MemberService.class);
        var dispatcher = mock(MemberNotificationPushDispatcher.class);
        var service = new AdminPushNotificationService(members, mock(MemberDeviceTokenRepository.class),
                mock(MemberNotificationRepository.class), Clock.systemUTC(), dispatcher);
        when(members.requireAdmin("session")).thenThrow(new MemberApiException(HttpStatus.FORBIDDEN, "ADMIN", "denied"));
        assertThatThrownBy(() -> service.dispatchPendingWithSummary("session")).isInstanceOf(MemberApiException.class);
        verifyNoInteractions(dispatcher);
    }

    @Test void controllerPreservesLegacyCountAndReturnsDetailedTotalsAfterAuthorization() {
        var members = mock(MemberService.class);
        var dispatcher = mock(MemberNotificationPushDispatcher.class);
        var service = new AdminPushNotificationService(members, mock(MemberDeviceTokenRepository.class),
                mock(MemberNotificationRepository.class), Clock.systemUTC(), dispatcher);
        var cookies = mock(SessionCookieSupport.class);
        var request = new MockHttpServletRequest();
        when(cookies.read(request)).thenReturn("admin");
        when(dispatcher.deliverPendingPushesWithSummary()).thenReturn(
                new MemberNotificationPushDispatcher.DispatchSummary(4, 1, 2, 1));
        var result = new AdminPushNotificationController(service, cookies).dispatch(request);
        assertThat(result).containsEntry("sentCount", 1).containsEntry("acceptedCount", 1)
                .containsEntry("selectedCount", 4).containsEntry("otherCount", 2).containsEntry("errorCount", 1);
        var order = inOrder(members, dispatcher);
        order.verify(members).requireAdmin("admin");
        order.verify(dispatcher).deliverPendingPushesWithSummary();
    }
}
