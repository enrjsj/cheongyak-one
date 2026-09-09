package com.cheongyakone.application;

import com.cheongyakone.domain.notice.NoticeChangeHistoryRepository;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoticeQueryServiceTest {

    @Mock
    private SubscriptionNoticeRepository noticeRepository;
    @Mock
    private NoticeChangeHistoryRepository changeHistoryRepository;

    @Test
    void findsNoticesWithoutOptionalFilters() {
        // 기본 목록 요청은 선택 필터가 하나도 없어도 전체 조회로 처리되어야 한다.
        when(noticeRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(Page.empty());

        NoticeQueryService service = new NoticeQueryService(noticeRepository, changeHistoryRepository,
                Clock.fixed(Instant.parse("2026-09-08T00:00:00Z"), ZoneOffset.UTC));

        var notices = service.findNotices(null, null, null, null, null, false, "DEADLINE", 0, 20);

        assertThat(notices).isEmpty();
    }

    @Test
    void returnsServerSideSearchFacetCounts() {
        when(noticeRepository.count(any(Specification.class))).thenReturn(10L, 1L, 3L, 2L);
        NoticeQueryService service = new NoticeQueryService(noticeRepository, changeHistoryRepository,
                Clock.fixed(Instant.parse("2026-09-08T00:00:00Z"), ZoneOffset.UTC));

        var facets = service.findFacets(null, "서울", null);

        assertThat(facets.total()).isEqualTo(10);
        assertThat(facets.endingToday()).isEqualTo(1);
        assertThat(facets.open()).isEqualTo(3);
        assertThat(facets.upcoming()).isEqualTo(2);
    }

    @Test
    void returnsEmptyChangeHistoryForExistingNotice() {
        when(noticeRepository.existsById(7L)).thenReturn(true);
        when(changeHistoryRepository.findTop20ByNoticeIdOrderByChangedAtDesc(7L)).thenReturn(java.util.List.of());
        NoticeQueryService service = new NoticeQueryService(noticeRepository, changeHistoryRepository,
                Clock.fixed(Instant.parse("2026-09-08T00:00:00Z"), ZoneOffset.UTC));

        assertThat(service.findChanges(7L)).isEmpty();
        verify(changeHistoryRepository).findTop20ByNoticeIdOrderByChangedAtDesc(7L);
    }
}
