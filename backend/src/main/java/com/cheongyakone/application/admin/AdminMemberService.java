package com.cheongyakone.application.admin;

import com.cheongyakone.api.admin.AdminMemberPageResponse;
import com.cheongyakone.api.admin.AdminMemberResponse;
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
}
