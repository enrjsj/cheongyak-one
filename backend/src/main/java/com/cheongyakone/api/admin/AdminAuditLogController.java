package com.cheongyakone.api.admin;

import com.cheongyakone.api.member.SessionCookieSupport;
import com.cheongyakone.application.admin.AdminAuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/audit-logs")
public class AdminAuditLogController {

    private final AdminAuditLogService auditLogService;
    private final SessionCookieSupport cookieSupport;

    public AdminAuditLogController(
            AdminAuditLogService auditLogService,
            SessionCookieSupport cookieSupport
    ) {
        this.auditLogService = auditLogService;
        this.cookieSupport = cookieSupport;
    }

    @GetMapping
    public List<AdminAuditLogResponse> recent(HttpServletRequest request) {
        return auditLogService.recent(cookieSupport.read(request));
    }
}
