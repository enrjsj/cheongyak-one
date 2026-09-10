package com.cheongyakone.api.admin;

import com.cheongyakone.api.member.SessionCookieSupport;
import com.cheongyakone.application.admin.AdminMemberService;
import com.cheongyakone.domain.member.MemberStatus;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/admin/members")
public class AdminMemberController {

    private final AdminMemberService adminMemberService;
    private final SessionCookieSupport cookieSupport;

    public AdminMemberController(
            AdminMemberService adminMemberService,
            SessionCookieSupport cookieSupport
    ) {
        this.adminMemberService = adminMemberService;
        this.cookieSupport = cookieSupport;
    }

    @GetMapping
    public AdminMemberPageResponse search(
            HttpServletRequest request,
            @RequestParam(required = false) @Size(max = 100) String query,
            @RequestParam(required = false) MemberStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        return adminMemberService.search(cookieSupport.read(request), query, status, page, size);
    }

    @GetMapping("/statistics")
    public AdminMemberStatisticsResponse statistics(HttpServletRequest request) {
        return adminMemberService.statistics(cookieSupport.read(request));
    }

    @PostMapping("/{memberId}/unlock")
    public AdminMemberResponse unlock(
            HttpServletRequest request,
            @PathVariable @Positive Long memberId
    ) {
        return adminMemberService.unlock(cookieSupport.read(request), memberId);
    }

    @DeleteMapping("/{memberId}/sessions")
    public ResponseEntity<Void> revokeSessions(
            HttpServletRequest request,
            @PathVariable @Positive Long memberId
    ) {
        adminMemberService.revokeSessions(cookieSupport.read(request), memberId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{memberId}/suspend")
    public AdminMemberResponse suspend(
            HttpServletRequest request,
            @PathVariable @Positive Long memberId,
            @Valid @RequestBody AdminMemberRequests.Suspend body
    ) {
        return adminMemberService.suspend(cookieSupport.read(request), memberId, body.reason());
    }

    @PostMapping("/{memberId}/reactivate")
    public AdminMemberResponse reactivate(
            HttpServletRequest request,
            @PathVariable @Positive Long memberId
    ) {
        return adminMemberService.reactivate(cookieSupport.read(request), memberId);
    }
}
