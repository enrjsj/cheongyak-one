package com.cheongyakone.application.member;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import com.cheongyakone.domain.member.MemberNotification.PushCompletionReason;

@Repository
public class MemberPushReceiptStore {
    private final JdbcTemplate jdbc;
    public MemberPushReceiptStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public Set<String> completed(Long notificationId) {
        return new HashSet<>(jdbc.queryForList(
                "SELECT TOKEN_HASH FROM MEMBER_PUSH_RECEIPT WHERE NOTIFICATION_ID=?", String.class, notificationId));
    }
    // Called under the notification row lock, in the delivery transaction.
    public void record(Long notificationId, Collection<String> tokens, Instant now) {
        record(notificationId, tokens, now, null);
    }
    public void recordAccepted(Long notificationId, Collection<String> tokens, Instant now) {
        record(notificationId, tokens, now, "ACCEPTED");
    }
    public void recordInvalid(Long notificationId, Collection<String> tokens, Instant now) {
        record(notificationId, tokens, now, "INVALID_TOKEN");
    }
    private void record(Long notificationId, Collection<String> tokens, Instant now, String outcome) {
        Set<String> existing = completed(notificationId);
        for (String token : new HashSet<>(tokens)) {
            String hash = hash(token);
            if (existing.add(hash)) jdbc.update(
                    "INSERT INTO MEMBER_PUSH_RECEIPT (NOTIFICATION_ID, TOKEN_HASH, COMPLETED_AT, OUTCOME) VALUES (?, ?, ?, ?)",
                    notificationId, hash, Timestamp.from(now), outcome);
        }
    }
    public PushCompletionReason completionReason(Long notificationId) {
        var outcomes = jdbc.queryForList("SELECT OUTCOME FROM MEMBER_PUSH_RECEIPT WHERE NOTIFICATION_ID=?", String.class, notificationId);
        if (outcomes.contains("ACCEPTED")) return PushCompletionReason.ACCEPTED;
        if (outcomes.stream().anyMatch(value -> !"INVALID_TOKEN".equals(value))) return PushCompletionReason.UNKNOWN;
        return outcomes.isEmpty() ? PushCompletionReason.NO_DEVICES : PushCompletionReason.INVALID_TOKENS;
    }
    public static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
}

