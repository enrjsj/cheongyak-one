package com.cheongyakone.api;

/** 공개 공고 데이터의 신선도 상태다. 동기화 실패 원문은 관리자 화면에서만 확인한다. */
public enum NoticeFreshnessStatus {
    FRESH,
    DELAYED,
    UNAVAILABLE
}
