package com.cheongyakone.application.member;

public interface MemberMailSender {

    void sendEmailVerification(String email, String verificationUrl);

    void sendPasswordReset(String email, String resetUrl);

    void sendNoticeNotification(
            String email,
            String noticeTitle,
            String notificationLabel,
            String message,
            String eventDate,
            String officialUrl
    );
}
