package com.cheongyakone.application;

import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class NoticeSyncRetryWaiter {

    public void pause(Duration delay) {
        if (delay.isZero()) {
            return;
        }
        try {
            Thread.sleep(delay.toMillis());
        } catch (InterruptedException exception) {
            // 종료 신호를 잃지 않도록 인터럽트 상태를 복구하고 현재 동기화를 중단한다.
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Notice synchronization retry was interrupted", exception);
        }
    }
}
