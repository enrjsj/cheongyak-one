package com.cheongyakone.domain.notice;

/**
 * 공고의 공급 방식을 단순하게 분류한다.
 * 기존 주택 매매 매물은 수집하지 않으므로 SALE은 "일반 매매"가 아닌 청약 분양을 뜻한다.
 */
public enum SupplyType {
    SALE,
    PUBLIC_RENTAL
}
