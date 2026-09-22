package com.cheongyakone.api;

import java.time.Instant;

/** 공개 화면이 공고 데이터 기준 시각을 표시할 때 사용하는 최소 응답이다. */
public record NoticeFreshnessResponse(Instant generatedAt, Instant lastCompletedAt) {
}
