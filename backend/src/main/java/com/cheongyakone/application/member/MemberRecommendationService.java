package com.cheongyakone.application.member;

import com.cheongyakone.api.NoticeSummaryResponse;
import com.cheongyakone.api.member.MemberRecommendationListResponse;
import com.cheongyakone.api.member.MemberRecommendationResponse;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberRecommendationDismissal;
import com.cheongyakone.domain.member.MemberRecommendationDismissalRepository;
import com.cheongyakone.domain.member.MemberSearchPreference;
import com.cheongyakone.domain.member.MemberSearchPreferenceRepository;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class MemberRecommendationService {

    private static final int MAXIMUM_CANDIDATES = 100;
    private static final int MAXIMUM_RECOMMENDATIONS = 6;

    private final MemberService memberService;
    private final MemberSearchPreferenceRepository preferenceRepository;
    private final MemberRecommendationDismissalRepository dismissalRepository;
    private final SubscriptionNoticeRepository noticeRepository;
    private final Clock clock;

    public MemberRecommendationService(
            MemberService memberService,
            MemberSearchPreferenceRepository preferenceRepository,
            MemberRecommendationDismissalRepository dismissalRepository,
            SubscriptionNoticeRepository noticeRepository,
            Clock clock
    ) {
        this.memberService = memberService;
        this.preferenceRepository = preferenceRepository;
        this.dismissalRepository = dismissalRepository;
        this.noticeRepository = noticeRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MemberRecommendationListResponse recommendations(String rawToken) {
        Member member = memberService.requireMember(rawToken);
        return preferenceRepository.findByMember_Id(member.getId())
                .map(preference -> recommend(member, preference))
                .orElseGet(MemberRecommendationListResponse::notConfigured);
    }

    @Transactional
    public void dismiss(String rawToken, Long noticeId) {
        Member member = memberService.requireMember(rawToken);
        if (dismissalRepository.existsByMemberIdAndNotice_Id(member.getId(), noticeId)) {
            return;
        }
        SubscriptionNotice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new MemberApiException(
                        HttpStatus.NOT_FOUND,
                        "NOTICE_NOT_FOUND",
                        "요청한 청약 공고를 찾지 못했습니다."
                ));
        dismissalRepository.save(new MemberRecommendationDismissal(member, notice, clock.instant()));
    }

    @Transactional
    public void resetDismissals(String rawToken) {
        Member member = memberService.requireMember(rawToken);
        dismissalRepository.deleteByMemberId(member.getId());
    }

    private MemberRecommendationListResponse recommend(Member member, MemberSearchPreference preference) {
        LocalDate today = LocalDate.now(clock);
        List<Long> dismissedNoticeIds = dismissalRepository.findNoticeIdsByMemberId(member.getId());
        Specification<SubscriptionNotice> specification = candidateSpecification(
                preference,
                today,
                dismissedNoticeIds
        );
        var candidates = noticeRepository.findAll(
                specification,
                PageRequest.of(
                        0,
                        MAXIMUM_CANDIDATES,
                        Sort.by(Sort.Order.asc("applyEndDate"), Sort.Order.desc("noticeDate"))
                )
        );

        List<MemberRecommendationResponse> recommendations = candidates.stream()
                .map(notice -> score(notice, preference, member, today))
                .sorted(Comparator
                        .comparingInt(MemberRecommendationResponse::score).reversed()
                        .thenComparing(
                                (MemberRecommendationResponse recommendation) ->
                                        recommendation.notice().applyEndDate(),
                                Comparator.nullsLast(Comparator.naturalOrder())
                        )
                        .thenComparing(
                                (MemberRecommendationResponse recommendation) ->
                                        recommendation.notice().noticeDate(),
                                Comparator.nullsLast(Comparator.reverseOrder())
                        ))
                .limit(MAXIMUM_RECOMMENDATIONS)
                .toList();
        return new MemberRecommendationListResponse(
                true,
                preference.getUpdatedAt(),
                dismissedNoticeIds.size(),
                recommendations
        );
    }

    private Specification<SubscriptionNotice> candidateSpecification(
            MemberSearchPreference preference,
            LocalDate today,
            List<Long> dismissedNoticeIds
    ) {
        Specification<SubscriptionNotice> specification =
                MemberNoticePreferenceMatcher.specification(preference, today);
        if (!dismissedNoticeIds.isEmpty()) {
            specification = specification.and((root, query, cb) ->
                    cb.not(root.get("id").in(dismissedNoticeIds)));
        }
        return specification;
    }

    private MemberRecommendationResponse score(
            SubscriptionNotice notice,
            MemberSearchPreference preference,
            Member member,
            LocalDate today
    ) {
        int score = 55;
        List<String> reasons = new ArrayList<>();
        if (preference.getRegion() != null) {
            score += 15;
            reasons.add(preference.getRegion() + " 지역 조건 일치");
        } else if (member.getResidenceRegion() != null
                && member.getResidenceRegion().equals(notice.getRegionCode())) {
            score += 8;
            reasons.add("거주 지역과 일치");
        }
        if (preference.getHousingCategory() != null) {
            score += 15;
            reasons.add(categoryLabel(preference));
        }
        score += 10;
        reasons.add(statusReason(notice, preference));

        long deadlineDays = daysUntil(today, notice.getApplyEndDate());
        if (deadlineDays == 0) {
            score += preference.getStatus() == SearchPreferenceStatus.TODAY ? 10 : 20;
            if (preference.getStatus() != SearchPreferenceStatus.TODAY) {
                reasons.add("오늘 접수 마감");
            }
        } else if (deadlineDays >= 1 && deadlineDays <= 3) {
            score += 15;
            reasons.add("마감 " + deadlineDays + "일 전");
        } else if (deadlineDays >= 4 && deadlineDays <= 7) {
            score += 10;
            reasons.add("일주일 안에 접수 마감");
        } else {
            long startDays = daysUntil(today, notice.getApplyStartDate());
            if (startDays >= 0 && startDays <= 7) {
                score += 10;
                reasons.add(startDays == 0 ? "오늘 접수 시작" : "접수 시작까지 " + startDays + "일");
            }
        }
        return new MemberRecommendationResponse(
                Math.min(score, 100),
                List.copyOf(reasons),
                NoticeSummaryResponse.from(notice)
        );
    }

    private long daysUntil(LocalDate today, LocalDate date) {
        return date == null ? Long.MAX_VALUE : ChronoUnit.DAYS.between(today, date);
    }

    private String categoryLabel(MemberSearchPreference preference) {
        return switch (preference.getHousingCategory()) {
            case APARTMENT -> "아파트 유형 일치";
            case PUBLIC_RENTAL -> "공공임대 유형 일치";
            case OFFICETEL -> "오피스텔 유형 일치";
        };
    }

    private String statusReason(SubscriptionNotice notice, MemberSearchPreference preference) {
        if (preference.getStatus() == SearchPreferenceStatus.TODAY) {
            return "오늘 마감 조건 일치";
        }
        return notice.getStatus() == NoticeStatus.UPCOMING ? "접수 예정 공고" : "현재 접수 가능한 공고";
    }
}
