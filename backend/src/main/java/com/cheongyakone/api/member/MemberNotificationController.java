package com.cheongyakone.api.member;

import com.cheongyakone.application.member.MemberNotificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/members/me/notifications")
public class MemberNotificationController {

    private final MemberNotificationService notificationService;
    private final SessionCookieSupport cookieSupport;

    public MemberNotificationController(
            MemberNotificationService notificationService,
            SessionCookieSupport cookieSupport
    ) {
        this.notificationService = notificationService;
        this.cookieSupport = cookieSupport;
    }

    @GetMapping
    public NotificationInboxResponse inbox(HttpServletRequest request) {
        return notificationService.inbox(cookieSupport.read(request));
    }

    @PatchMapping("/{notificationId}/read")
    public MemberNotificationResponse markRead(
            HttpServletRequest request,
            @PathVariable @Positive Long notificationId
    ) {
        return notificationService.markRead(cookieSupport.read(request), notificationId);
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(HttpServletRequest request) {
        notificationService.markAllRead(cookieSupport.read(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/preference")
    public NotificationPreferenceResponse preference(HttpServletRequest request) {
        return notificationService.preference(cookieSupport.read(request));
    }

    @PutMapping("/preference")
    public NotificationPreferenceResponse savePreference(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.NotificationPreference request
    ) {
        return notificationService.savePreference(cookieSupport.read(servletRequest), request);
    }
}
