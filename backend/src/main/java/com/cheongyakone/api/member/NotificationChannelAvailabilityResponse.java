package com.cheongyakone.api.member;

import java.util.List;

public record NotificationChannelAvailabilityResponse(List<Channel> channels) {
    public record Channel(
            String id,
            String label,
            boolean available,
            String message
    ) {
    }
}
