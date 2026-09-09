package com.cheongyakone.infrastructure.mail;

import com.cheongyakone.application.member.MemberMailSender;
import com.cheongyakone.config.MemberMailProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.member-mail.delivery", havingValue = "smtp")
public class SmtpMemberMailSender implements MemberMailSender {

    private final JavaMailSender mailSender;
    private final MemberMailProperties properties;

    public SmtpMemberMailSender(JavaMailSender mailSender, MemberMailProperties properties) {
        this.mailSender = mailSender;
        this.properties = properties;
    }

    @Override
    public void sendEmailVerification(String email, String verificationUrl) {
        send(email, "[청약한눈] 이메일 인증", "아래 링크에서 이메일 인증을 완료해주세요.\n\n" + verificationUrl);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl) {
        send(email, "[청약한눈] 비밀번호 재설정", "아래 링크에서 새 비밀번호를 설정해주세요.\n\n" + resetUrl);
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
        String safeTitle = noticeTitle.replace('\r', ' ').replace('\n', ' ');
        StringBuilder text = new StringBuilder()
                .append(safeTitle).append("\n\n")
                .append(message).append("\n")
                .append(notificationLabel).append(" 기준일: ").append(eventDate);
        if (officialUrl != null && !officialUrl.isBlank()) {
            text.append("\n\n공식 공고 확인\n").append(officialUrl);
        }
        send(email, "[청약한눈] " + safeTitle + " " + notificationLabel + " 알림", text.toString());
    }

    private void send(String email, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.fromAddress());
        message.setTo(email);
        message.setSubject(subject);
        message.setText(text);
        mailSender.send(message);
    }
}
