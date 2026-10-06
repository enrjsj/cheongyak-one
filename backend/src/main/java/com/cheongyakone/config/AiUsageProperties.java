package com.cheongyakone.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import java.math.BigDecimal;

/** Operator-supplied USD prices per million tokens; never assume a provider tariff. */
@ConfigurationProperties("app.ai-consultation.usage")
public record AiUsageProperties(String pricedModel, BigDecimal inputUsdPerMillion,
        BigDecimal cachedInputUsdPerMillion, BigDecimal outputUsdPerMillion, BigDecimal dailyBudgetUsd) {
    public AiUsageProperties {
        pricedModel = pricedModel == null ? "" : pricedModel.strip();
        dailyBudgetUsd = dailyBudgetUsd == null ? BigDecimal.ZERO : dailyBudgetUsd;
        boolean anyPrice = inputUsdPerMillion != null || cachedInputUsdPerMillion != null || outputUsdPerMillion != null;
        if (pricedModel.length() > 128 || dailyBudgetUsd.signum() < 0 || dailyBudgetUsd.compareTo(new BigDecimal("1000000")) > 0
                || (anyPrice && (pricedModel.isEmpty() || inputUsdPerMillion == null || cachedInputUsdPerMillion == null || outputUsdPerMillion == null))
                || (dailyBudgetUsd.signum() > 0 && !anyPrice)) throw new IllegalArgumentException("Invalid AI pricing or budget configuration");
        for (BigDecimal rate : new BigDecimal[]{inputUsdPerMillion, cachedInputUsdPerMillion, outputUsdPerMillion}) {
            if (rate != null && (rate.signum() < 0 || rate.compareTo(new BigDecimal("10000")) > 0 || rate.scale() > 8))
                throw new IllegalArgumentException("Invalid AI token price");
        }
        if (anyPrice && cachedInputUsdPerMillion.compareTo(inputUsdPerMillion) > 0)
            throw new IllegalArgumentException("Cached AI price must not exceed input price");
        if (dailyBudgetUsd.scale() > 8) throw new IllegalArgumentException("Invalid AI budget precision");
    }
    public boolean priced(String model) { return inputUsdPerMillion != null && pricedModel.equals(model); }
    public static AiUsageProperties unconfigured() { return new AiUsageProperties("", null, null, null, null); }
}
