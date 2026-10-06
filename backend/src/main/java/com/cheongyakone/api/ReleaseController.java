package com.cheongyakone.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class ReleaseController {
    private final String revision;
    public ReleaseController(@Value("${RENDER_GIT_COMMIT:${GITHUB_SHA:unknown}}") String revision) {
        this.revision = revision.matches("[0-9a-f]{40}") ? revision : "unknown";
    }
    @GetMapping("/api/v1/release")
    public ResponseEntity<Map<String, String>> release() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("revision", revision));
    }
}
