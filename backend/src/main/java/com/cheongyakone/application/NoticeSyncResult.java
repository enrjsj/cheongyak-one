package com.cheongyakone.application;

public record NoticeSyncResult(
        int fetchedCount,
        int savedCount
) {
}
