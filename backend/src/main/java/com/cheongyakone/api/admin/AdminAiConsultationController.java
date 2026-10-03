package com.cheongyakone.api.admin;

import com.cheongyakone.api.member.SessionCookieSupport;
import com.cheongyakone.application.member.AiConsultationLimiter;
import com.cheongyakone.application.member.MemberService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/ai-consultations/usage")
public class AdminAiConsultationController {
    private final MemberService members;
    private final SessionCookieSupport cookies;
    private final AiConsultationLimiter usage;
    public AdminAiConsultationController(MemberService members, SessionCookieSupport cookies, AiConsultationLimiter usage) {
        this.members = members; this.cookies = cookies; this.usage = usage;
    }
    @GetMapping
    public List<AiConsultationLimiter.DayUsage> usage(HttpServletRequest request) {
        members.requireAdmin(cookies.read(request));
        return usage.recentUsage();
    }
}
