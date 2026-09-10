package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberSearchPreference;
import com.cheongyakone.domain.member.MemberSearchPreferenceRepository;
import com.cheongyakone.domain.member.MemberRecommendationDismissalRepository;
import com.cheongyakone.domain.member.SearchPreferenceSort;
import com.cheongyakone.domain.member.SearchPreferenceStatus;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberRecommendationServiceTest {

    private static final Instant NOW = Instant.parse("2026-09-04T00:00:00Z");

    @Mock
    private MemberService memberService;

    @Mock
    private MemberSearchPreferenceRepository preferenceRepository;

    @Mock
    private MemberRecommendationDismissalRepository dismissalRepository;

    @Mock
    private SubscriptionNoticeRepository noticeRepository;

    @Mock
    private Member member;

    @Test
    void scoresMatchingActionableNoticeAndExplainsWhy() {
        MemberSearchPreference preference = new MemberSearchPreference(member, NOW);
        preference.change(
                null,
                HousingCategory.APARTMENT,
                SearchPreferenceStatus.OPEN,
                SearchPreferenceSort.DEADLINE,
                null,
                null,
                NOW
        );
        SubscriptionNotice notice = notice("추천 아파트", LocalDate.of(2026, 9, 6));
        when(member.getId()).thenReturn(1L);
        when(member.getResidenceRegion()).thenReturn("서울");
        when(member.getPersonalProfileConsentedAt()).thenReturn(NOW);
        when(memberService.requireMember("token")).thenReturn(member);
        when(preferenceRepository.findByMember_Id(1L)).thenReturn(Optional.of(preference));
        when(dismissalRepository.findNoticeIdsByMemberId(1L)).thenReturn(List.of());
        when(noticeRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(notice)));

        var result = service().recommendations("token");

        assertThat(result.configured()).isTrue();
        assertThat(result.recommendations()).hasSize(1);
        assertThat(result.recommendations().getFirst().score()).isEqualTo(100);
        assertThat(result.recommendations().getFirst().reasons())
                .containsExactly("거주 지역과 일치", "아파트 유형 일치", "현재 접수 가능한 공고", "마감 2일 전");
    }

    @Test
    void returnsConfigurationGuideWhenPreferenceDoesNotExist() {
        when(member.getId()).thenReturn(1L);
        when(memberService.requireMember("token")).thenReturn(member);
        when(preferenceRepository.findByMember_Id(1L)).thenReturn(Optional.empty());

        var result = service().recommendations("token");

        assertThat(result.configured()).isFalse();
        assertThat(result.recommendations()).isEmpty();
    }

    private MemberRecommendationService service() {
        return new MemberRecommendationService(
                memberService,
                preferenceRepository,
                dismissalRepository,
                noticeRepository,
                Clock.fixed(NOW, ZoneOffset.UTC)
        );
    }

    private SubscriptionNotice notice(String title, LocalDate applyEndDate) {
        SubscriptionNotice notice = new SubscriptionNotice(
                SourceSystem.REB_APT,
                "recommendation-unit-test",
                HousingCategory.APARTMENT,
                NoticeStatus.OPEN,
                title
        );
        notice.updateFrom(new NoticeSnapshot(
                SourceSystem.REB_APT,
                "recommendation-unit-test",
                HousingCategory.APARTMENT,
                NoticeStatus.OPEN,
                title,
                "서울",
                "서울시 테스트구",
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 2),
                applyEndDate,
                null,
                null,
                null,
                null,
                null,
                "recommendation-unit-test-hash"
        ), NOW);
        return notice;
    }
}
