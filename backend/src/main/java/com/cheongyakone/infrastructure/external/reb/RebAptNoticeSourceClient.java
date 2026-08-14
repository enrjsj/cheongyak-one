package com.cheongyakone.infrastructure.external.reb;

import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.infrastructure.external.NoticeSourceClient;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class RebAptNoticeSourceClient implements NoticeSourceClient {

    private final RebApiGateway gateway;

    public RebAptNoticeSourceClient(RebApiGateway gateway) {
        this.gateway = gateway;
    }

    @Override
    public SourceSystem sourceSystem() {
        return SourceSystem.REB_APT;
    }

    @Override
    public List<NoticeSnapshot> fetch(LocalDate from, LocalDate to) {
        return gateway.fetch(RebNoticeType.APARTMENT, from, to);
    }
}
