package com.cheongyakone.api.admin;

import com.cheongyakone.api.member.SessionCookieSupport;
import com.cheongyakone.application.admin.AdminSyncDashboardService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/sync-executions")
public class AdminSyncDashboardController {

    private final AdminSyncDashboardService dashboardService;
    private final SessionCookieSupport cookieSupport;

    public AdminSyncDashboardController(
            AdminSyncDashboardService dashboardService,
            SessionCookieSupport cookieSupport
    ) {
        this.dashboardService = dashboardService;
        this.cookieSupport = cookieSupport;
    }

    @GetMapping
    public AdminSyncDashboardResponse dashboard(HttpServletRequest request) {
        return dashboardService.dashboard(cookieSupport.read(request));
    }
}
