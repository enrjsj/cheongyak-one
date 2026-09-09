package com.cheongyakone.infrastructure.mail;

import com.cheongyakone.application.member.MemberMailSender;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.member-mail.delivery", havingValue = "log", matchIfMissing = true)
public class LoggingMemberMailSender implements MemberMailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingMemberMailSender.class);

    @Override
    public void sendEmailVerification(String email, String verificationUrl) {
        log.info("Local email verification for {}: {}", email, verificationUrl);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl) {
        log.info("Local password reset for {}: {}", email, resetUrl);
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
        log.info("Local notice notification for {}: title={}, eventDate={}", email, noticeTitle, eventDate);
    }
}
