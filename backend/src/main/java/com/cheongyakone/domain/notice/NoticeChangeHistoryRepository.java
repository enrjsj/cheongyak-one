package com.cheongyakone.domain.notice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface NoticeChangeHistoryRepository extends JpaRepository<NoticeChangeHistory, Long> {
    List<NoticeChangeHistory> findTop20ByNoticeIdOrderByChangedAtDesc(Long noticeId);
    boolean existsByNoticeIdAndChangedAt(Long noticeId, Instant changedAt);
}
