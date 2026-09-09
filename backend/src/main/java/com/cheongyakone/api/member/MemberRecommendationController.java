package com.cheongyakone.api.member;

import com.cheongyakone.application.member.MemberRecommendationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/v1/members/me/recommendations")
public class MemberRecommendationController {

    private final MemberRecommendationService recommendationService;
    private final SessionCookieSupport cookieSupport;

    public MemberRecommendationController(
            MemberRecommendationService recommendationService,
            SessionCookieSupport cookieSupport
    ) {
        this.recommendationService = recommendationService;
        this.cookieSupport = cookieSupport;
    }

    @GetMapping
    public MemberRecommendationListResponse recommendations(HttpServletRequest request) {
        return recommendationService.recommendations(cookieSupport.read(request));
    }

    @PostMapping("/{noticeId}/dismiss")
    public ResponseEntity<Void> dismiss(
            HttpServletRequest request,
            @PathVariable @Positive Long noticeId
    ) {
        recommendationService.dismiss(cookieSupport.read(request), noticeId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/dismissed")
    public ResponseEntity<Void> resetDismissals(HttpServletRequest request) {
        recommendationService.resetDismissals(cookieSupport.read(request));
        return ResponseEntity.noContent().build();
    }
}
