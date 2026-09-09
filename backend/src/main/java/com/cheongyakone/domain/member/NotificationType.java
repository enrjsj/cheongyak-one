package com.cheongyakone.domain.member;

public enum NotificationType {
    APPLY_START("오늘 청약 접수가 시작됩니다."),
    APPLY_DEADLINE_7D("청약 접수 마감까지 7일 남았습니다."),
    APPLY_DEADLINE_3D("청약 접수 마감까지 3일 남았습니다."),
    APPLY_DEADLINE_1D("청약 접수 마감까지 1일 남았습니다."),
    WINNER_ANNOUNCEMENT("오늘 당첨자 발표 예정입니다."),
    NEW_MATCHING_NOTICE("저장한 검색조건에 맞는 새 공고가 등록됐습니다."),
    NOTICE_UPDATED("관심 공고의 일정 또는 주요 정보가 변경됐습니다.");

    private final String message;

    NotificationType(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
