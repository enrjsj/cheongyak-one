package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.ai-consultation")
public record AiConsultationProperties(boolean enabled, String apiKey, String model) {
    public AiConsultationProperties {
        apiKey = apiKey == null ? "" : apiKey.trim();
        model = model == null ? "" : model.trim();
        if (enabled && (apiKey.isBlank() || model.isBlank())) {
            throw new IllegalArgumentException("AI consultation requires OPENAI_API_KEY and OPENAI_MODEL");
        }
    }

    // Never include credentials in diagnostics.
    @Override public String toString() {
        return "AiConsultationProperties[enabled=" + enabled + "]";
    }
}
