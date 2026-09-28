package com.cheongyakone.application;

/** 주택형 보강 실행 결과. 공고 동기화와 분리해 실패 건수를 운영 로그에 남긴다. */
public record UnitTypeSyncResult(
        int attemptedNoticeCount,
        int synchronizedNoticeCount,
        int savedUnitTypeCount,
        int failedNoticeCount,
        boolean disabled
) {
    public static UnitTypeSyncResult disabled() {
        return new UnitTypeSyncResult(0, 0, 0, 0, true);
    }
}
