package com.cheongyakone.infrastructure.mail;

import com.cheongyakone.application.member.MemberMailSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailSendException;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.member-mail.delivery", havingValue = "disabled")
public class DisabledMemberMailSender implements MemberMailSender {

    private static final Logger log = LoggerFactory.getLogger(DisabledMemberMailSender.class);

    @Override
    public void sendEmailVerification(String email, String verificationUrl) {
        log.warn("Email verification delivery is disabled for {}", email);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl) {
        log.warn("Password reset delivery is disabled for {}", email);
    }

    @Override
    public void sendNoticeNotification(
            String email,
            String noticeTitle,
            String notificationLabel,
            String message,
            String eventDate,
            String officialUrl
    ) {
        throw new MailSendException("Member mail delivery is disabled");
    }
}
