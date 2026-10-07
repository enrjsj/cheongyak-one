package com.cheongyakone.application.admin;

import com.cheongyakone.application.NoticeFreshnessService;
import com.cheongyakone.application.NoticeSyncCoordinator;
import com.cheongyakone.application.member.MemberApiException;
import com.cheongyakone.application.member.MemberService;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import java.time.Clock;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class NoticeSupplierQualityServiceTest {
    @Test
    void emptyDatabaseReportsEverySourceWithZeroCountsUsingOneAggregateQuery() {
        var repository = mock(SubscriptionNoticeRepository.class);
        when(repository.summarizeSupplierQuality(anyString())).thenReturn(List.of());
        var result = new NoticeSupplierQualityService(repository).summarize();
        assertThat(result).extracting(item -> item.sourceSystem()).containsExactly(SourceSystem.values());
        assertThat(result).allSatisfy(item -> {
            assertThat(item.totalCount()).isZero();
            assertThat(item.missingSupplierCount()).isZero();
        });
        verify(repository).summarizeSupplierQuality(anyString());
        verifyNoMoreInteractions(repository);
    }

    @Test
    void dashboardChecksAdminBeforeReadingSupplierCounts() {
        var members = mock(MemberService.class);
        var executions = mock(SyncExecutionRepository.class);
        var quality = mock(NoticeSupplierQualityService.class);
        doThrow(new MemberApiException(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "관리자 권한 필요"))
                .when(members).requireAdmin("regular-session");
        var dashboard = new AdminSyncDashboardService(members, executions, mock(NoticeSyncCoordinator.class),
                Clock.systemUTC(), mock(NoticeFreshnessService.class), quality);
        assertThatThrownBy(() -> dashboard.dashboard("regular-session")).isInstanceOf(MemberApiException.class);
        verifyNoInteractions(executions, quality);
    }
}
