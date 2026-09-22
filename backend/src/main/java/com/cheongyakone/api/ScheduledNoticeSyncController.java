package com.cheongyakone.api;

import com.cheongyakone.application.ScheduledNoticeSyncService;
import com.cheongyakone.config.ScheduledNoticeSyncProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** GitHub Actions 전용 일배치 진입점. 브라우저·회원 API와 분리한다. */
@RestController
@RequestMapping("/internal/scheduled-notice-sync")
@ConditionalOnProperty(name = "app.scheduled-notice-sync.enabled", havingValue = "true")
public class ScheduledNoticeSyncController {

    private final ScheduledNoticeSyncProperties properties;
    private final ScheduledNoticeSyncService scheduledNoticeSyncService;

    public ScheduledNoticeSyncController(
            ScheduledNoticeSyncProperties properties,
            ScheduledNoticeSyncService scheduledNoticeSyncService
    ) {
        this.properties = properties;
        this.scheduledNoticeSyncService = scheduledNoticeSyncService;
    }

    @PostMapping
    public ResponseEntity<ScheduledNoticeSyncService.ScheduledNoticeSyncResult> synchronize(
            @RequestHeader(value = "X-Scheduled-Sync-Key", required = false) String apiKey
    ) {
        if (!properties.accepts(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        ScheduledNoticeSyncService.ScheduledNoticeSyncResult result = scheduledNoticeSyncService.synchronize();
        return result.started()
                ? ResponseEntity.ok(result)
                : ResponseEntity.status(HttpStatus.CONFLICT).body(result);
    }
}
