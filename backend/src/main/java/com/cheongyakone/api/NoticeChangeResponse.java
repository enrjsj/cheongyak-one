package com.cheongyakone.api;

import com.cheongyakone.domain.notice.NoticeChangeHistory;

import java.time.Instant;

public record NoticeChangeResponse(Long id, String summary, Instant changedAt) {
    public static NoticeChangeResponse from(NoticeChangeHistory history) {
        return new NoticeChangeResponse(history.getId(), history.getChangeSummary(), history.getChangedAt());
    }
}
