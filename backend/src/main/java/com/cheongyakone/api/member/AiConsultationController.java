package com.cheongyakone.api.member;

import com.cheongyakone.application.member.AiConsultationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/members/me/ai-consultations")
public class AiConsultationController {
    private final AiConsultationService service;
    private final SessionCookieSupport cookies;
    public AiConsultationController(AiConsultationService service, SessionCookieSupport cookies) {
        this.service = service; this.cookies = cookies;
    }
    @GetMapping("/availability")
    public ResponseEntity<Map<String, Boolean>> availability(HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(Map.of("available", service.available(cookies.read(request))));
    }
    @PostMapping
    public ResponseEntity<AiConsultationService.Result> consult(HttpServletRequest request,
            @Valid @RequestBody ConsultationRequest body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.consult(
                cookies.read(request), body.noticeId(), body.topic(), body.consent()));
    }
    public record ConsultationRequest(@NotNull @Positive Long noticeId,
            @NotNull AiConsultationService.Topic topic, boolean consent) {}
}
