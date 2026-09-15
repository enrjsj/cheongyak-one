package com.cheongyakone.api.admin;

import com.cheongyakone.api.member.SessionCookieSupport;
import com.cheongyakone.application.admin.AdminPushNotificationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/notifications/push")
public class AdminPushNotificationController {
    private final AdminPushNotificationService pushNotificationService;
    private final SessionCookieSupport cookieSupport;

    public AdminPushNotificationController(AdminPushNotificationService pushNotificationService, SessionCookieSupport cookieSupport) {
        this.pushNotificationService = pushNotificationService;
        this.cookieSupport = cookieSupport;
    }

    @GetMapping
    public AdminPushNotificationResponse dashboard(HttpServletRequest request) {
        return pushNotificationService.dashboard(cookieSupport.read(request));
    }

    @PostMapping("/dispatch")
    public java.util.Map<String, Integer> dispatch(HttpServletRequest request) {
        return java.util.Map.of("sentCount", pushNotificationService.dispatchPending(cookieSupport.read(request)));
    }

    @PostMapping("/{notificationId}/retry")
    public org.springframework.http.ResponseEntity<Void> retry(HttpServletRequest request, @PathVariable Long notificationId) {
        pushNotificationService.retryFailed(cookieSupport.read(request), notificationId);
        return org.springframework.http.ResponseEntity.noContent().build();
    }
}
