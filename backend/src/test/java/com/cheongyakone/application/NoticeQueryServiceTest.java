package com.cheongyakone.application;

import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoticeQueryServiceTest {

    @Mock
    private SubscriptionNoticeRepository noticeRepository;

    @Test
    void findsNoticesWithoutOptionalFilters() {
        // 기본 목록 요청은 선택 필터가 하나도 없어도 전체 조회로 처리되어야 한다.
        when(noticeRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(Page.empty());

        NoticeQueryService service = new NoticeQueryService(noticeRepository);

        var notices = service.findNotices(null, null, null, null, 0, 20);

        assertThat(notices).isEmpty();
    }
}
