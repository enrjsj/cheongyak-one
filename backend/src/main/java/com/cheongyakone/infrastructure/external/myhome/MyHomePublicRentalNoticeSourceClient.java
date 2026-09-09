package com.cheongyakone.infrastructure.external.myhome;

import com.cheongyakone.config.MyHomeApiProperties;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.infrastructure.external.NoticeSourceClient;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class MyHomePublicRentalNoticeSourceClient implements NoticeSourceClient {

    private final MyHomeApiGateway gateway;
    private final MyHomeApiProperties properties;

    public MyHomePublicRentalNoticeSourceClient(MyHomeApiGateway gateway, MyHomeApiProperties properties) {
        this.gateway = gateway;
        this.properties = properties;
    }

    @Override
    public SourceSystem sourceSystem() {
        return SourceSystem.MYHOME_PUBLIC_RENTAL;
    }

    @Override
    public boolean enabled() {
        return properties.configured();
    }

    @Override
    public List<NoticeSnapshot> fetch(LocalDate from, LocalDate to) {
        return gateway.fetch(from, to);
    }
}
