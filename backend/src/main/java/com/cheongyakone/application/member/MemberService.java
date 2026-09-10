package com.cheongyakone.application.member;

import com.cheongyakone.api.member.MemberRequests;
import com.cheongyakone.api.member.MemberResponse;
import com.cheongyakone.api.member.MemberSessionResponse;
import com.cheongyakone.api.member.EligibilityProfileResponse;
import com.cheongyakone.api.member.SearchPreferenceResponse;
import com.cheongyakone.config.AuthProperties;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberActionTokenRepository;
import com.cheongyakone.domain.member.MemberComparison;
import com.cheongyakone.domain.member.MemberComparisonRepository;
import com.cheongyakone.domain.member.MemberFavorite;
import com.cheongyakone.domain.member.MemberFavoriteRepository;
import com.cheongyakone.domain.member.MemberGender;
import com.cheongyakone.domain.member.MemberEligibilityProfile;
import com.cheongyakone.domain.member.MemberEligibilityProfileRepository;
import com.cheongyakone.domain.member.MemberLoginSession;
import com.cheongyakone.domain.member.MemberLoginSessionRepository;
import com.cheongyakone.domain.member.MemberMaritalStatus;
import com.cheongyakone.domain.member.MemberNotificationPreferenceRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import com.cheongyakone.domain.member.MemberRecommendationDismissalRepository;
import com.cheongyakone.domain.member.MemberRepository;
import com.cheongyakone.domain.member.MemberSearchPreference;
import com.cheongyakone.domain.member.MemberSearchPreferenceRepository;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class MemberService {

    private static final int MAXIMUM_LOGIN_ATTEMPTS = 5;
    private static final int MAXIMUM_ACTIVE_SESSIONS = 10;
    private static final int MAXIMUM_COMPARISONS = 3;
    public static final String PERSONAL_PROFILE_CONSENT_VERSION = "2026-09-10-v2";
    private static final Duration LOGIN_LOCK_DURATION = Duration.ofMinutes(10);
    private static final Set<String> RESIDENCE_REGIONS = Set.of(
            "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
            "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"
    );

    private final MemberRepository memberRepository;
    private final MemberActionTokenRepository actionTokenRepository;
    private final MemberLoginSessionRepository sessionRepository;
    private final MemberFavoriteRepository favoriteRepository;
    private final MemberComparisonRepository comparisonRepository;
    private final MemberEligibilityProfileRepository eligibilityProfileRepository;
    private final MemberSearchPreferenceRepository searchPreferenceRepository;
    private final MemberNotificationPreferenceRepository notificationPreferenceRepository;
    private final MemberNotificationRepository notificationRepository;
    private final MemberRecommendationDismissalRepository recommendationDismissalRepository;
    private final SubscriptionNoticeRepository noticeRepository;
    private final PasswordEncoder passwordEncoder;
    private final SessionTokenCodec tokenCodec;
    private final LoginClientParser loginClientParser;
    private final AuthProperties authProperties;
    private final Clock clock;
    private final MemberAccountRecoveryService accountRecoveryService;
    private final String dummyPasswordHash;

    public MemberService(
            MemberRepository memberRepository,
            MemberActionTokenRepository actionTokenRepository,
            MemberLoginSessionRepository sessionRepository,
            MemberFavoriteRepository favoriteRepository,
            MemberComparisonRepository comparisonRepository,
            MemberEligibilityProfileRepository eligibilityProfileRepository,
            MemberSearchPreferenceRepository searchPreferenceRepository,
            MemberNotificationPreferenceRepository notificationPreferenceRepository,
            MemberNotificationRepository notificationRepository,
            MemberRecommendationDismissalRepository recommendationDismissalRepository,
            SubscriptionNoticeRepository noticeRepository,
            PasswordEncoder passwordEncoder,
            SessionTokenCodec tokenCodec,
            LoginClientParser loginClientParser,
            AuthProperties authProperties,
            Clock clock,
            MemberAccountRecoveryService accountRecoveryService
    ) {
        this.memberRepository = memberRepository;
        this.actionTokenRepository = actionTokenRepository;
        this.sessionRepository = sessionRepository;
        this.favoriteRepository = favoriteRepository;
        this.comparisonRepository = comparisonRepository;
        this.eligibilityProfileRepository = eligibilityProfileRepository;
        this.searchPreferenceRepository = searchPreferenceRepository;
        this.notificationPreferenceRepository = notificationPreferenceRepository;
        this.notificationRepository = notificationRepository;
        this.recommendationDismissalRepository = recommendationDismissalRepository;
        this.noticeRepository = noticeRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenCodec = tokenCodec;
        this.loginClientParser = loginClientParser;
        this.authProperties = authProperties;
        this.clock = clock;
        this.accountRecoveryService = accountRecoveryService;
        this.dummyPasswordHash = passwordEncoder.encode("timing-only-password");
    }

    @Transactional
    public MemberResponse signup(MemberRequests.Signup request) {
        String email = Member.normalizeEmail(request.email());
        if (memberRepository.existsByEmail(email)) {
            throw conflict("EMAIL_ALREADY_USED", "이미 가입된 이메일입니다.");
        }
        validateNewPassword(request.password());
        validatePersonalProfile(request.birthDate(), request.residenceRegion());
        requirePersonalProfileConsent(
                request.birthDate(),
                request.gender(),
                request.maritalStatus(),
                request.householdMemberCount(),
                request.childCount(),
                request.residenceRegion(),
                request.personalProfileConsent()
        );
        Instant now = clock.instant();
        Member member = new Member(
                email,
                passwordEncoder.encode(request.password()),
                request.nickname(),
                request.birthDate(),
                request.gender(),
                request.maritalStatus(),
                request.householdMemberCount(),
                request.childCount(),
                request.residenceRegion(),
                PERSONAL_PROFILE_CONSENT_VERSION,
                now
        );
        try {
            // 동시 가입 요청도 DB 유니크 제약에서 즉시 확인하도록 flush한다.
            Member saved = memberRepository.saveAndFlush(member);
            accountRecoveryService.prepareSignup(saved);
            return MemberResponse.from(saved);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("EMAIL_ALREADY_USED", "이미 가입된 이메일입니다.");
        }
    }

    @Transactional(noRollbackFor = MemberApiException.class)
    public LoginResult login(MemberRequests.Login request, String userAgent) {
        Instant now = clock.instant();
        // 행 잠금으로 동시에 들어온 실패 요청도 잠금 횟수에서 누락되지 않게 한다.
        Member member = memberRepository.findForAuthentication(Member.normalizeEmail(request.email()))
                .filter(Member::isActive)
                .orElse(null);
        if (member == null) {
            // 미가입 이메일도 BCrypt 연산을 수행해 응답 시간으로 가입 여부를 추측하기 어렵게 한다.
            passwordMatches(request.password(), dummyPasswordHash);
            throw invalidCredentials();
        }
        member.clearExpiredLock(now);
        if (member.isLocked(now)) {
            throw locked(member.getLockedUntil());
        }
        if (!passwordMatches(request.password(), member.getPasswordHash())) {
            boolean newlyLocked = member.recordFailedLogin(
                    now,
                    MAXIMUM_LOGIN_ATTEMPTS,
                    now.plus(LOGIN_LOCK_DURATION)
            );
            if (newlyLocked) {
                throw locked(member.getLockedUntil());
            }
            throw invalidCredentials();
        }

        member.recordSuccessfulLogin(now);
        if (!member.isEmailVerified()) {
            throw new MemberApiException(
                    HttpStatus.FORBIDDEN,
                    "EMAIL_VERIFICATION_REQUIRED",
                    "로그인 전에 이메일 인증을 완료해주세요."
            );
        }
        String rawToken = tokenCodec.createRawToken();
        Instant expiresAt = now.plus(authProperties.sessionDuration());
        sessionRepository.save(new MemberLoginSession(
                member,
                tokenCodec.hash(rawToken),
                expiresAt,
                now,
                loginClientParser.parse(userAgent)
        ));
        List<MemberLoginSession> activeSessions = sessionRepository
                .findAllByMemberIdAndExpiresAtAfterOrderByCreatedAtDescIdDesc(member.getId(), now);
        if (activeSessions.size() > MAXIMUM_ACTIVE_SESSIONS) {
            // 장기간 사용 시 세션 행이 무제한 증가하지 않도록 가장 오래된 로그인을 먼저 종료한다.
            sessionRepository.deleteAll(activeSessions.subList(MAXIMUM_ACTIVE_SESSIONS, activeSessions.size()));
        }
        return new LoginResult(MemberResponse.from(member), rawToken, expiresAt);
    }

    @Transactional(readOnly = true)
    public Member requireMember(String rawToken) {
        return requireSession(rawToken).getMember();
    }

    @Transactional(readOnly = true)
    public Member requireAdmin(String rawToken) {
        Member member = requireMember(rawToken);
        if (!member.isAdmin()) {
            throw new MemberApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "관리자 권한이 필요합니다.");
        }
        return member;
    }

    @Transactional(readOnly = true)
    public List<MemberSessionResponse> sessions(String rawToken) {
        MemberLoginSession currentSession = requireSession(rawToken);
        return sessionRepository.findAllByMemberIdAndExpiresAtAfterOrderByCreatedAtDescIdDesc(
                        currentSession.getMember().getId(),
                        clock.instant()
                ).stream()
                .map(session -> MemberSessionResponse.from(session, currentSession.getId()))
                .toList();
    }

    @Transactional
    public void revokeSession(String rawToken, Long sessionId) {
        MemberLoginSession currentSession = requireSession(rawToken);
        if (currentSession.getId().equals(sessionId)) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "CURRENT_SESSION_CANNOT_BE_REVOKED",
                    "현재 기기는 로그아웃 버튼으로 종료해주세요."
            );
        }
        MemberLoginSession session = sessionRepository.findByIdAndMemberIdAndExpiresAtAfter(
                        sessionId,
                        currentSession.getMember().getId(),
                        clock.instant()
                )
                .orElseThrow(() -> new MemberApiException(
                        HttpStatus.NOT_FOUND,
                        "SESSION_NOT_FOUND",
                        "이미 종료됐거나 찾을 수 없는 로그인 기기입니다."
                ));
        sessionRepository.delete(session);
    }

    @Transactional
    public List<MemberSessionResponse> revokeOtherSessions(String rawToken) {
        MemberLoginSession currentSession = requireSession(rawToken);
        sessionRepository.deleteByMemberIdAndIdNot(currentSession.getMember().getId(), currentSession.getId());
        return List.of(MemberSessionResponse.from(currentSession, currentSession.getId()));
    }

    private MemberLoginSession requireSession(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw unauthorized();
        }
        return sessionRepository.findByTokenHashAndExpiresAtAfter(tokenCodec.hash(rawToken), clock.instant())
                .filter(session -> session.getMember().isActive())
                .orElseThrow(this::unauthorized);
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken != null && !rawToken.isBlank()) {
            sessionRepository.deleteByTokenHash(tokenCodec.hash(rawToken));
        }
    }

    @Transactional(readOnly = true)
    public MemberResponse me(String rawToken) {
        return MemberResponse.from(requireMember(rawToken));
    }

    @Transactional
    public MemberResponse updateProfile(String rawToken, MemberRequests.UpdateProfile request) {
        Member member = requireMember(rawToken);
        validatePersonalProfile(request.birthDate(), request.residenceRegion());
        requirePersonalProfileConsent(
                request.birthDate(),
                request.gender(),
                request.maritalStatus(),
                request.householdMemberCount(),
                request.childCount(),
                request.residenceRegion(),
                request.personalProfileConsent()
        );
        member.changeProfile(
                request.nickname(),
                request.birthDate(),
                request.gender(),
                request.maritalStatus(),
                request.householdMemberCount(),
                request.childCount(),
                request.residenceRegion(),
                Boolean.TRUE.equals(request.personalProfileConsent()),
                PERSONAL_PROFILE_CONSENT_VERSION,
                clock.instant()
        );
        return MemberResponse.from(member);
    }

    @Transactional
    public MemberResponse deletePersonalProfile(String rawToken) {
        Member member = requireMember(rawToken);
        member.clearPersonalProfile(clock.instant());
        return MemberResponse.from(member);
    }

    @Transactional
    public void changePassword(String rawToken, MemberRequests.ChangePassword request) {
        Member member = requireMember(rawToken);
        if (!passwordMatches(request.currentPassword(), member.getPasswordHash())) {
            throw invalidCurrentPassword();
        }
        validateNewPassword(request.newPassword());
        if (passwordMatches(request.newPassword(), member.getPasswordHash())) {
            throw new MemberApiException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED", "새 비밀번호를 다르게 입력해주세요.");
        }
        member.changePassword(passwordEncoder.encode(request.newPassword()), clock.instant());
        // 비밀번호 변경 후 탈취된 다른 기기를 포함한 모든 세션을 폐기한다.
        sessionRepository.deleteByMemberId(member.getId());
        actionTokenRepository.deleteByMemberId(member.getId());
    }

    @Transactional
    public void withdraw(String rawToken, MemberRequests.Withdraw request) {
        Member member = requireMember(rawToken);
        if (!passwordMatches(request.password(), member.getPasswordHash())) {
            throw invalidCurrentPassword();
        }
        sessionRepository.deleteByMemberId(member.getId());
        favoriteRepository.deleteByMemberId(member.getId());
        comparisonRepository.deleteByMemberId(member.getId());
        eligibilityProfileRepository.deleteByMember_Id(member.getId());
        searchPreferenceRepository.deleteByMember_Id(member.getId());
        notificationPreferenceRepository.deleteByMember_Id(member.getId());
        notificationRepository.deleteByMemberId(member.getId());
        recommendationDismissalRepository.deleteByMemberId(member.getId());
        actionTokenRepository.deleteByMemberId(member.getId());
        member.withdraw(clock.instant());
    }

    @Transactional(readOnly = true)
    public List<Long> favoriteIds(String rawToken) {
        Member member = requireMember(rawToken);
        return favoriteRepository.findAllByMemberIdOrderByCreatedAtAsc(member.getId()).stream()
                .map(MemberFavorite::getNoticeId)
                .toList();
    }

    @Transactional
    public List<Long> addFavorite(String rawToken, Long noticeId) {
        Member member = requireMember(rawToken);
        if (!favoriteRepository.existsByMemberIdAndNotice_Id(member.getId(), noticeId)) {
            SubscriptionNotice notice = noticeRepository.findById(noticeId)
                    .orElseThrow(() -> new MemberApiException(
                            HttpStatus.NOT_FOUND,
                            "NOTICE_NOT_FOUND",
                            "요청한 청약 공고를 찾지 못했습니다."
                    ));
            favoriteRepository.save(new MemberFavorite(member, notice, clock.instant()));
        }
        // 관심 저장은 추천 제외보다 최신 의사이므로 해당 공고의 숨김 상태를 해제한다.
        recommendationDismissalRepository.deleteByMemberIdAndNotice_Id(member.getId(), noticeId);
        return favoriteIds(rawToken);
    }

    @Transactional
    public List<Long> removeFavorite(String rawToken, Long noticeId) {
        Member member = requireMember(rawToken);
        favoriteRepository.deleteByMemberIdAndNotice_Id(member.getId(), noticeId);
        notificationRepository.deleteByMemberIdAndNotice_Id(member.getId(), noticeId);
        return favoriteIds(rawToken);
    }

    @Transactional
    public List<Long> mergeFavorites(String rawToken, Set<Long> requestedNoticeIds) {
        Member member = requireMember(rawToken);
        Set<Long> existingIds = new LinkedHashSet<>(favoriteIds(rawToken));
        List<SubscriptionNotice> notices = noticeRepository.findAllById(requestedNoticeIds);
        for (SubscriptionNotice notice : notices) {
            if (existingIds.add(notice.getId())) {
                favoriteRepository.save(new MemberFavorite(member, notice, clock.instant()));
            }
            recommendationDismissalRepository.deleteByMemberIdAndNotice_Id(member.getId(), notice.getId());
        }
        return favoriteIds(rawToken);
    }

    @Transactional(readOnly = true)
    public List<Long> comparisonIds(String rawToken) {
        Member member = requireMember(rawToken);
        return comparisonIds(member.getId());
    }

    @Transactional
    public List<Long> addComparison(String rawToken, Long noticeId) {
        Member member = lockCurrentMember(rawToken);
        if (comparisonRepository.existsByMemberIdAndNotice_Id(member.getId(), noticeId)) {
            return comparisonIds(member.getId());
        }
        List<Long> existingIds = comparisonIds(member.getId());
        if (existingIds.size() >= MAXIMUM_COMPARISONS) {
            throw new MemberApiException(
                    HttpStatus.CONFLICT,
                    "COMPARISON_LIMIT_REACHED",
                    "공고는 최대 3개까지 비교할 수 있습니다."
            );
        }
        SubscriptionNotice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new MemberApiException(
                        HttpStatus.NOT_FOUND,
                        "NOTICE_NOT_FOUND",
                        "요청한 청약 공고를 찾지 못했습니다."
                ));
        comparisonRepository.save(new MemberComparison(member, notice, clock.instant()));
        return comparisonIds(member.getId());
    }

    @Transactional
    public List<Long> removeComparison(String rawToken, Long noticeId) {
        Member member = lockCurrentMember(rawToken);
        comparisonRepository.deleteByMemberIdAndNotice_Id(member.getId(), noticeId);
        return comparisonIds(member.getId());
    }

    @Transactional
    public List<Long> mergeComparisons(String rawToken, List<Long> requestedNoticeIds) {
        Member member = lockCurrentMember(rawToken);
        LinkedHashSet<Long> mergedIds = new LinkedHashSet<>(requestedNoticeIds);
        mergedIds.addAll(comparisonIds(member.getId()));
        List<SubscriptionNotice> validNotices = noticeRepository.findAllById(mergedIds);
        comparisonRepository.deleteByMemberId(member.getId());
        comparisonRepository.flush();
        Instant now = clock.instant();
        validNotices.stream()
                .sorted(java.util.Comparator.comparingInt(notice -> indexOf(mergedIds, notice.getId())))
                .limit(MAXIMUM_COMPARISONS)
                .forEach(notice -> comparisonRepository.save(new MemberComparison(member, notice, now)));
        return comparisonIds(member.getId());
    }

    @Transactional
    public List<Long> clearComparisons(String rawToken) {
        Member member = lockCurrentMember(rawToken);
        comparisonRepository.deleteByMemberId(member.getId());
        return List.of();
    }

    private Member lockCurrentMember(String rawToken) {
        Long memberId = requireMember(rawToken).getId();
        return memberRepository.findByIdForUpdate(memberId).orElseThrow(this::unauthorized);
    }

    private List<Long> comparisonIds(Long memberId) {
        return comparisonRepository.findAllByMemberIdOrderByCreatedAtAscIdAsc(memberId).stream()
                .map(MemberComparison::getNoticeId)
                .toList();
    }

    private int indexOf(LinkedHashSet<Long> ids, Long target) {
        int index = 0;
        for (Long id : ids) {
            if (id.equals(target)) return index;
            index += 1;
        }
        return Integer.MAX_VALUE;
    }

    @Transactional(readOnly = true)
    public Optional<SearchPreferenceResponse> searchPreference(String rawToken) {
        Member member = requireMember(rawToken);
        return searchPreferenceRepository.findByMember_Id(member.getId())
                .map(SearchPreferenceResponse::from);
    }

    @Transactional
    public SearchPreferenceResponse saveSearchPreference(
            String rawToken,
            MemberRequests.SearchPreference request
    ) {
        Member member = requireMember(rawToken);
        Instant now = clock.instant();
        MemberSearchPreference preference = searchPreferenceRepository.findByMember_Id(member.getId())
                .orElseGet(() -> new MemberSearchPreference(member, now));
        preference.change(
                request.region(),
                request.housingCategory(),
                request.status(),
                request.sort(),
                now
        );
        return SearchPreferenceResponse.from(searchPreferenceRepository.save(preference));
    }

    @Transactional
    public void deleteSearchPreference(String rawToken) {
        Member member = requireMember(rawToken);
        searchPreferenceRepository.deleteByMember_Id(member.getId());
    }

    @Transactional(readOnly = true)
    public Optional<EligibilityProfileResponse> eligibilityProfile(String rawToken) {
        Member member = requireMember(rawToken);
        return eligibilityProfileRepository.findByMember_Id(member.getId())
                .map(EligibilityProfileResponse::from);
    }

    @Transactional
    public EligibilityProfileResponse saveEligibilityProfile(
            String rawToken,
            MemberRequests.EligibilityProfile request
    ) {
        Member member = requireMember(rawToken);
        Instant now = clock.instant();
        MemberEligibilityProfile profile = eligibilityProfileRepository.findByMember_Id(member.getId())
                .orElseGet(() -> new MemberEligibilityProfile(member, now));
        profile.change(request.homeless(), request.subscriptionAccount(), request.newlywed(), request.firstHome(), now);
        return EligibilityProfileResponse.from(eligibilityProfileRepository.save(profile));
    }

    @Transactional
    public void deleteEligibilityProfile(String rawToken) {
        Member member = requireMember(rawToken);
        eligibilityProfileRepository.deleteByMember_Id(member.getId());
    }

    @Scheduled(cron = "0 30 4 * * *", zone = "Asia/Seoul")
    @Transactional
    public void deleteExpiredSessions() {
        sessionRepository.deleteByExpiresAtBefore(clock.instant());
    }

    private void validateNewPassword(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "PASSWORD_TOO_LONG",
                    "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."
            );
        }
    }

    private void validatePersonalProfile(LocalDate birthDate, String residenceRegion) {
        LocalDate today = LocalDate.now(clock);
        if (birthDate != null && birthDate.isBefore(today.minusYears(120))) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_BIRTH_DATE",
                    "생년월일을 다시 확인해주세요."
            );
        }
        if (residenceRegion != null
                && !residenceRegion.isBlank()
                && !RESIDENCE_REGIONS.contains(residenceRegion.trim())) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_RESIDENCE_REGION",
                    "거주 지역을 목록에서 선택해주세요."
            );
        }
    }

    private void requirePersonalProfileConsent(
            LocalDate birthDate,
            MemberGender gender,
            MemberMaritalStatus maritalStatus,
            Integer householdMemberCount,
            Integer childCount,
            String residenceRegion,
            Boolean personalProfileConsent
    ) {
        boolean hasPersonalProfile = birthDate != null
                || gender != null
                || maritalStatus != null
                || householdMemberCount != null
                || childCount != null
                || (residenceRegion != null && !residenceRegion.isBlank());
        if (hasPersonalProfile && !Boolean.TRUE.equals(personalProfileConsent)) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "PERSONAL_PROFILE_CONSENT_REQUIRED",
                    "맞춤 정보를 저장하려면 개인정보 수집·이용에 동의해주세요."
            );
        }
    }

    private boolean passwordMatches(String rawPassword, String passwordHash) {
        return rawPassword.getBytes(StandardCharsets.UTF_8).length <= 72
                && passwordEncoder.matches(rawPassword, passwordHash);
    }

    private MemberApiException unauthorized() {
        return new MemberApiException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "로그인이 필요합니다.");
    }

    private MemberApiException invalidCredentials() {
        return new MemberApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호를 확인해주세요.");
    }

    private MemberApiException invalidCurrentPassword() {
        return new MemberApiException(HttpStatus.BAD_REQUEST, "INVALID_CURRENT_PASSWORD", "현재 비밀번호가 일치하지 않습니다.");
    }

    private MemberApiException locked(Instant lockedUntil) {
        return new MemberApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "LOGIN_LOCKED",
                "로그인 시도가 많아 잠시 잠겼습니다. " + lockedUntil + " 이후 다시 시도해주세요."
        );
    }

    private MemberApiException conflict(String code, String message) {
        return new MemberApiException(HttpStatus.CONFLICT, code, message);
    }

    public record LoginResult(MemberResponse member, String rawToken, Instant expiresAt) {
    }
}
