package com.cheongyakone.application.member;

import com.cheongyakone.config.AiUsageProperties;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AiUsageConfigurationTest {
    @Test void positiveBudgetRequiresCompletePricesAndExactModel() {
        assertThatThrownBy(() -> new AiUsageProperties("model", null, null, null, BigDecimal.ONE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiUsageProperties("model", BigDecimal.ONE, null, BigDecimal.ONE, BigDecimal.ZERO)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiUsageProperties("model", BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ONE)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AiUsageProperties("model", BigDecimal.ONE.negate(), BigDecimal.ZERO, BigDecimal.ONE, BigDecimal.ONE)).isInstanceOf(IllegalArgumentException.class);
        var prices = new AiUsageProperties("model", BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.TEN, BigDecimal.ONE);
        assertThat(prices.priced("model")).isTrue();
        assertThat(prices.priced("different")).isFalse();
        assertThat(AiUsageProperties.unconfigured().priced("model")).isFalse();
    }
}
