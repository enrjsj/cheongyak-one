package com.cheongyakone.infrastructure.external.reb;

import com.cheongyakone.config.RebApiProperties;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
public class RebApartmentUnitTypeClient {
    private final RebApiGateway gateway;
    private final RebApiProperties properties;

    public RebApartmentUnitTypeClient(RebApiGateway gateway, RebApiProperties properties) {
        this.gateway = gateway;
        this.properties = properties;
    }
    public boolean enabled() { return properties.configured(); }
    public List<RebApartmentUnitTypeSnapshot> fetch(String sourceNoticeId) { return gateway.fetchApartmentUnitTypes(sourceNoticeId); }
}
