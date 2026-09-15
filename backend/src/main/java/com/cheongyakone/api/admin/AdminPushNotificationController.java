package com.cheongyakone.api.admin;

import com.cheongyakone.api.member.SessionCookieSupport;
import com.cheongyakone.application.admin.AdminPushNotificationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
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
}
