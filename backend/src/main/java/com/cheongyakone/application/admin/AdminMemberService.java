package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.AdminMemberPageResponse;
import com.cheongyakone.api.admin.AdminMemberResponse;
import com.cheongyakone.api.admin.AdminMemberStatisticsResponse;
import com.cheongyakone.application.member.MemberApiException;
import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.domain.admin.AdminAuditAction;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberActionTokenRepository;
import com.cheongyakone.domain.member.MemberLoginSessionRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import com.cheongyakone.domain.member.MemberRepository;
import com.cheongyakone.domain.member.MemberStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminMemberService {

    private final MemberService memberService;
    private final MemberRepository memberRepository;
    private final MemberLoginSessionRepository sessionRepository;
    private final MemberActionTokenRepository actionTokenRepository;
    private final MemberNotificationRepository notificationRepository;
    private final Clock clock;
    private final AdminAuditLogService auditLogService;

    public AdminMemberService(
            MemberService memberService,
            MemberRepository memberRepository,
            MemberLoginSessionRepository sessionRepository,
            MemberActionTokenRepository actionTokenRepository,
            MemberNotificationRepository notificationRepository,
            Clock clock,
            AdminAuditLogService auditLogService
    ) {
        this.memberService = memberService;
        this.memberRepository = memberRepository;
        this.sessionRepository = sessionRepository;
        this.actionTokenRepository = actionTokenRepository;
        this.notificationRepository = notificationRepository;
        this.clock = clock;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public AdminMemberPageResponse search(
            String rawToken,
            String query,
            MemberStatus status,
            int page,
            int size
    ) {
        memberService.requireAdmin(rawToken);
        String normalizedQuery = query == null || query.isBlank() ? null : query.trim();
        var result = memberRepository.searchForAdmin(
                normalizedQuery,
                status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"))
        );
        Instant now = clock.instant();
        var memberIds = result.getContent().stream().map(Member::getId).toList();
        Map<Long, Long> sessionCounts = memberIds.isEmpty()
                ? Map.of()
                : sessionRepository.countActiveByMemberIds(memberIds, now).stream()
                        .collect(Collectors.toMap(
                                MemberLoginSessionRepository.MemberSessionCount::getMemberId,
                                MemberLoginSessionRepository.MemberSessionCount::getSessionCount
                        ));
        return new AdminMemberPageResponse(
                result.getContent().stream()
                        .map(member -> AdminMemberResponse.from(
                                member,
                                sessionCounts.getOrDefault(member.getId(), 0L)
                        ))
                        .toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public AdminMemberStatisticsResponse statistics(String rawToken) {
        memberService.requireAdmin(rawToken);
        MemberStatus active = MemberStatus.ACTIVE;
        LocalDate today = LocalDate.now(clock);

        Map<String, Long> genderCounts = buckets("FEMALE", "MALE", "OTHER");
        addCategoryCounts(genderCounts, memberRepository.countProfiledByGender(active));

        Map<String, Long> ageCounts = buckets(
                "UNDER_20", "TWENTIES", "THIRTIES", "FORTIES", "FIFTIES", "SIXTIES_PLUS"
        );
        memberRepository.countProfiledByBirthDate(active).forEach(row -> {
            LocalDate birthDate = (LocalDate) row[0];
            int age = Period.between(birthDate, today).getYears();
            String key = age < 20 ? "UNDER_20"
                    : age < 30 ? "TWENTIES"
                    : age < 40 ? "THIRTIES"
                    : age < 50 ? "FORTIES"
                    : age < 60 ? "FIFTIES"
                    : "SIXTIES_PLUS";
            ageCounts.merge(key, ((Number) row[1]).longValue(), Long::sum);
        });

        Map<String, Long> maritalCounts = buckets("SINGLE", "MARRIED");
        addCategoryCounts(maritalCounts, memberRepository.countProfiledByMaritalStatus(active));

        List<AdminMemberStatisticsResponse.Bucket> residenceRegions = memberRepository
                .countProfiledByResidenceRegion(active).stream()
                .map(row -> bucket(String.valueOf(row[0]), String.valueOf(row[0]), row[1]))
                .toList();

        Map<String, Long> householdCounts = buckets("ONE", "TWO", "THREE", "FOUR_PLUS");
        addNumberCounts(householdCounts, memberRepository.countProfiledByHouseholdMemberCount(active), false);
        Map<String, Long> childCounts = buckets("ZERO", "ONE", "TWO", "THREE_PLUS");
        addNumberCounts(childCounts, memberRepository.countProfiledByChildCount(active), true);

        return new AdminMemberStatisticsResponse(
                memberRepository.countByStatus(active),
                memberRepository.countByStatusAndPersonalProfileConsentedAtIsNotNull(active),
                toBuckets(genderCounts, Map.of("FEMALE", "여성", "MALE", "남성", "OTHER", "기타")),
                toBuckets(ageCounts, Map.of(
                        "UNDER_20", "20세 미만", "TWENTIES", "20대", "THIRTIES", "30대",
                        "FORTIES", "40대", "FIFTIES", "50대", "SIXTIES_PLUS", "60대 이상"
                )),
                toBuckets(maritalCounts, Map.of("SINGLE", "미혼", "MARRIED", "기혼")),
                residenceRegions,
                toBuckets(householdCounts, Map.of(
                        "ONE", "1명", "TWO", "2명", "THREE", "3명", "FOUR_PLUS", "4명 이상"
                )),
                toBuckets(childCounts, Map.of(
                        "ZERO", "0명", "ONE", "1명", "TWO", "2명", "THREE_PLUS", "3명 이상"
                )),
                clock.instant()
        );
    }

    @Transactional
    public AdminMemberResponse unlock(String rawToken, Long memberId) {
        Member administrator = memberService.requireAdmin(rawToken);
        Member member = target(memberId);
        if (member.getStatus() != MemberStatus.ACTIVE) {
            throw new MemberApiException(
                    HttpStatus.CONFLICT,
                    "MEMBER_NOT_ACTIVE",
                    "이용 중인 회원의 로그인 잠금만 초기화할 수 있습니다."
            );
        }
        boolean changed = member.unlockLogin(clock.instant());
        auditLogService.record(
                administrator,
                member,
                AdminAuditAction.MEMBER_LOGIN_UNLOCKED,
                changed ? 1 : 0
        );
        return AdminMemberResponse.from(member, activeSessionCount(memberId));
    }

    @Transactional
    public void revokeSessions(String rawToken, Long memberId) {
        Member administrator = memberService.requireAdmin(rawToken);
        if (administrator.getId().equals(memberId)) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "CANNOT_REVOKE_OWN_ADMIN_SESSIONS",
                    "현재 관리자 계정은 회원관리 화면에서 강제 로그아웃할 수 없습니다."
            );
        }
        Member member = target(memberId);
        long revokedCount = sessionRepository.deleteByMemberId(memberId);
        auditLogService.record(
                administrator,
                member,
                AdminAuditAction.MEMBER_SESSIONS_REVOKED,
                Math.toIntExact(revokedCount)
        );
    }

    @Transactional
    public AdminMemberResponse suspend(String rawToken, Long memberId, String reason) {
        Member administrator = memberService.requireAdmin(rawToken);
        Member member = target(memberId);
        ensureSuspendable(administrator, member);
        member.suspend(clock.instant());
        long revokedSessions = sessionRepository.deleteByMemberId(memberId);
        actionTokenRepository.deleteByMemberId(memberId);
        notificationRepository.cancelPendingEmailDeliveries(memberId);
        auditLogService.record(
                administrator,
                member,
                AdminAuditAction.MEMBER_SUSPENDED,
                Math.toIntExact(revokedSessions),
                reason
        );
        return AdminMemberResponse.from(member, 0);
    }

    @Transactional
    public AdminMemberResponse reactivate(String rawToken, Long memberId) {
        Member administrator = memberService.requireAdmin(rawToken);
        Member member = target(memberId);
        if (member.getStatus() != MemberStatus.SUSPENDED) {
            throw new MemberApiException(
                    HttpStatus.CONFLICT,
                    "MEMBER_NOT_SUSPENDED",
                    "이용정지 상태의 회원만 해제할 수 있습니다."
            );
        }
        member.reactivate(clock.instant());
        auditLogService.record(administrator, member, AdminAuditAction.MEMBER_REACTIVATED, 1);
        return AdminMemberResponse.from(member, 0);
    }

    private Member target(Long memberId) {
        return memberRepository.findByIdForUpdate(memberId)
                .orElseThrow(() -> new MemberApiException(
                        HttpStatus.NOT_FOUND,
                        "MEMBER_NOT_FOUND",
                        "회원을 찾을 수 없습니다."
                ));
    }

    private void ensureSuspendable(Member administrator, Member member) {
        if (administrator.getId().equals(member.getId()) || member.isAdmin()) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "ADMIN_MEMBER_CANNOT_BE_SUSPENDED",
                    "관리자 계정은 회원관리 화면에서 이용정지할 수 없습니다."
            );
        }
        if (member.getStatus() != MemberStatus.ACTIVE) {
            throw new MemberApiException(
                    HttpStatus.CONFLICT,
                    "MEMBER_NOT_ACTIVE",
                    "이용 중인 회원만 정지할 수 있습니다."
            );
        }
    }

    private long activeSessionCount(Long memberId) {
        return sessionRepository.countActiveByMemberIds(java.util.List.of(memberId), clock.instant()).stream()
                .findFirst()
                .map(MemberLoginSessionRepository.MemberSessionCount::getSessionCount)
                .orElse(0L);
    }

    private Map<String, Long> buckets(String... keys) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String key : keys) {
            counts.put(key, 0L);
        }
        return counts;
    }

    private void addCategoryCounts(Map<String, Long> target, List<Object[]> rows) {
        rows.forEach(row -> target.put(String.valueOf(row[0]), ((Number) row[1]).longValue()));
    }

    private void addNumberCounts(Map<String, Long> target, List<Object[]> rows, boolean includeZero) {
        rows.forEach(row -> {
            int value = ((Number) row[0]).intValue();
            String key;
            if (includeZero && value == 0) {
                key = "ZERO";
            } else if (value <= 1) {
                key = "ONE";
            } else if (value == 2) {
                key = "TWO";
            } else if (!includeZero && value == 3) {
                key = "THREE";
            } else {
                key = includeZero ? "THREE_PLUS" : "FOUR_PLUS";
            }
            target.merge(key, ((Number) row[1]).longValue(), Long::sum);
        });
    }

    private List<AdminMemberStatisticsResponse.Bucket> toBuckets(
            Map<String, Long> counts,
            Map<String, String> labels
    ) {
        return counts.entrySet().stream()
                .map(entry -> new AdminMemberStatisticsResponse.Bucket(
                        entry.getKey(), labels.get(entry.getKey()), entry.getValue()
                ))
                .toList();
    }

    private AdminMemberStatisticsResponse.Bucket bucket(String key, String label, Object count) {
        return new AdminMemberStatisticsResponse.Bucket(key, label, ((Number) count).longValue());
    }
}
