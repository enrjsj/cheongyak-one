package com.cheongyakone.infrastructure.external;

import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.SourceSystem;

import java.time.LocalDate;
import java.util.List;

public interface NoticeSourceClient {

    SourceSystem sourceSystem();

    /**
     * 선택형 API 키가 없는 수집기는 실행 대상에서 제외한다.
     */
    default boolean enabled() {
        return true;
    }

    List<NoticeSnapshot> fetch(LocalDate from, LocalDate to);
}
