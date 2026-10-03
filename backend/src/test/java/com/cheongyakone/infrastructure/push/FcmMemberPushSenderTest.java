package com.cheongyakone.infrastructure.push;

import com.google.firebase.messaging.MessagingErrorCode;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FcmMemberPushSenderTest {
    @Test void onlyConfirmedUnregisteredTokensAreDeleted() {
        for (MessagingErrorCode code : MessagingErrorCode.values()) {
            assertThat(FcmMemberPushSender.isExpiredToken(code))
                    .isEqualTo(code == MessagingErrorCode.UNREGISTERED);
        }
        assertThat(FcmMemberPushSender.isExpiredToken(null)).isFalse();
    }
}
