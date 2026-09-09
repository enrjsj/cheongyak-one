package com.cheongyakone.api.member;

import com.cheongyakone.application.member.MemberService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

@Validated
@RestController
@RequestMapping("/api/v1/members/me")
public class MemberController {

    private final MemberService memberService;
    private final SessionCookieSupport cookieSupport;

    public MemberController(MemberService memberService, SessionCookieSupport cookieSupport) {
        this.memberService = memberService;
        this.cookieSupport = cookieSupport;
    }

    @GetMapping
    public MemberResponse me(HttpServletRequest request) {
        return memberService.me(token(request));
    }

    @PatchMapping
    public MemberResponse updateProfile(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.UpdateProfile request
    ) {
        return memberService.updateProfile(token(servletRequest), request);
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.ChangePassword request
    ) {
        memberService.changePassword(token(servletRequest), request);
        return clearedCookieResponse();
    }

    @DeleteMapping
    public ResponseEntity<Void> withdraw(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.Withdraw request
    ) {
        memberService.withdraw(token(servletRequest), request);
        return clearedCookieResponse();
    }

    @GetMapping("/favorites")
    public FavoriteIdsResponse favorites(HttpServletRequest request) {
        return new FavoriteIdsResponse(memberService.favoriteIds(token(request)));
    }

    @PutMapping("/favorites/{noticeId}")
    public FavoriteIdsResponse addFavorite(
            HttpServletRequest request,
            @PathVariable @Positive Long noticeId
    ) {
        return new FavoriteIdsResponse(memberService.addFavorite(token(request), noticeId));
    }

    @DeleteMapping("/favorites/{noticeId}")
    public FavoriteIdsResponse removeFavorite(
            HttpServletRequest request,
            @PathVariable @Positive Long noticeId
    ) {
        return new FavoriteIdsResponse(memberService.removeFavorite(token(request), noticeId));
    }

    @PostMapping("/favorites/merge")
    public FavoriteIdsResponse mergeFavorites(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.MergeFavorites request
    ) {
        return new FavoriteIdsResponse(memberService.mergeFavorites(token(servletRequest), request.noticeIds()));
    }

    @GetMapping("/comparisons")
    public ComparisonIdsResponse comparisons(HttpServletRequest request) {
        return new ComparisonIdsResponse(memberService.comparisonIds(token(request)));
    }

    @PutMapping("/comparisons/{noticeId}")
    public ComparisonIdsResponse addComparison(
            HttpServletRequest request,
            @PathVariable @Positive Long noticeId
    ) {
        return new ComparisonIdsResponse(memberService.addComparison(token(request), noticeId));
    }

    @DeleteMapping("/comparisons/{noticeId}")
    public ComparisonIdsResponse removeComparison(
            HttpServletRequest request,
            @PathVariable @Positive Long noticeId
    ) {
        return new ComparisonIdsResponse(memberService.removeComparison(token(request), noticeId));
    }

    @PostMapping("/comparisons/merge")
    public ComparisonIdsResponse mergeComparisons(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.MergeComparisons request
    ) {
        return new ComparisonIdsResponse(memberService.mergeComparisons(token(servletRequest), request.noticeIds()));
    }

    @DeleteMapping("/comparisons")
    public ComparisonIdsResponse clearComparisons(HttpServletRequest request) {
        return new ComparisonIdsResponse(memberService.clearComparisons(token(request)));
    }

    @GetMapping("/search-preference")
    public ResponseEntity<SearchPreferenceResponse> searchPreference(HttpServletRequest request) {
        Optional<SearchPreferenceResponse> preference = memberService.searchPreference(token(request));
        return preference.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/search-preference")
    public SearchPreferenceResponse saveSearchPreference(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.SearchPreference request
    ) {
        return memberService.saveSearchPreference(token(servletRequest), request);
    }

    @DeleteMapping("/search-preference")
    public ResponseEntity<Void> deleteSearchPreference(HttpServletRequest request) {
        memberService.deleteSearchPreference(token(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/eligibility-profile")
    public ResponseEntity<EligibilityProfileResponse> eligibilityProfile(HttpServletRequest request) {
        return memberService.eligibilityProfile(token(request))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/eligibility-profile")
    public EligibilityProfileResponse saveEligibilityProfile(
            HttpServletRequest servletRequest,
            @Valid @RequestBody MemberRequests.EligibilityProfile request
    ) {
        return memberService.saveEligibilityProfile(token(servletRequest), request);
    }

    @DeleteMapping("/eligibility-profile")
    public ResponseEntity<Void> deleteEligibilityProfile(HttpServletRequest request) {
        memberService.deleteEligibilityProfile(token(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/sessions")
    public List<MemberSessionResponse> sessions(HttpServletRequest request) {
        return memberService.sessions(token(request));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> revokeSession(
            HttpServletRequest request,
            @PathVariable @Positive Long sessionId
    ) {
        memberService.revokeSession(token(request), sessionId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/sessions/others")
    public List<MemberSessionResponse> revokeOtherSessions(HttpServletRequest request) {
        return memberService.revokeOtherSessions(token(request));
    }

    private String token(HttpServletRequest request) {
        return cookieSupport.read(request);
    }

    private ResponseEntity<Void> clearedCookieResponse() {
        return ResponseEntity.noContent()
                .header(
                        HttpHeaders.SET_COOKIE,
                        cookieSupport.clear().toString(),
                        cookieSupport.clearCsrf().toString()
                )
                .build();
    }
}
