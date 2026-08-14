package com.cheongyakone.infrastructure.external;

import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.SourceSystem;

import java.time.LocalDate;
import java.util.List;

public interface NoticeSourceClient {

    SourceSystem sourceSystem();

    List<NoticeSnapshot> fetch(LocalDate from, LocalDate to);
}
