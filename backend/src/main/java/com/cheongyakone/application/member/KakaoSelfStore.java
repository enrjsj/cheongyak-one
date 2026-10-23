package com.cheongyakone.application.member;

import com.cheongyakone.config.KakaoSelfProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;

@Repository
public class KakaoSelfStore {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    public KakaoSelfStore(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(manager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public Connection read() { return jdbc.queryForObject("SELECT * FROM KAKAO_SELF_CONNECTION WHERE ID=1", (rs, row) -> connection(rs)); }
    private Connection lock() { return jdbc.queryForObject("SELECT * FROM KAKAO_SELF_CONNECTION WHERE ID=1 FOR UPDATE", (rs, row) -> connection(rs)); }
    private <T> T transact(Supplier<T> action) { return tx.execute(status -> action.get()); }
    public void begin(Long memberId, String stateHash, String sessionHash, Instant expires) {
        transact(() -> {
            Connection current = lock();
            if (!Objects.equals(current.memberId(), memberId)) clear();
            jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET MEMBER_ID=?, GENERATION=?, STATE_HASH=?, SESSION_HASH=?, STATE_EXPIRES_AT=? WHERE ID=1",
                    memberId, UUID.randomUUID().toString(), stateHash, sessionHash, timestamp(expires));
            return null;
        });
    }
    public String consumeState(Long memberId, String stateHash, String sessionHash, Instant now) {
        return transact(() -> {
            Connection row = lock();
            if (!Objects.equals(row.memberId(), memberId) || !Objects.equals(row.stateHash(), stateHash)
                    || !Objects.equals(row.sessionHash(), sessionHash) || row.stateExpiresAt() == null || !row.stateExpiresAt().isAfter(now)) return null;
            jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET STATE_HASH=NULL, SESSION_HASH=NULL, STATE_EXPIRES_AT=NULL WHERE ID=1");
            return row.generation();
        });
    }
    public boolean connect(Long memberId, String generation, String access, String refresh, Instant accessExpiry, Instant refreshExpiry, Instant now) {
        return transact(() -> {
            Connection current = lock();
            if (!Objects.equals(current.memberId(), memberId) || !current.generation().equals(generation)) return false;
            long cutoff = jdbc.queryForObject("SELECT COALESCE(MAX(ID),0) FROM MEMBER_NOTIFICATION WHERE MEMBER_ID=?", Long.class, memberId);
            return jdbc.update("""
                    UPDATE KAKAO_SELF_CONNECTION SET GENERATION=?, ACCESS_TOKEN=?, REFRESH_TOKEN=?, ACCESS_EXPIRES_AT=?,
                    REFRESH_EXPIRES_AT=?, CONNECTED_AT=?, CUTOFF_ID=?, RECONNECT_REQUIRED=FALSE,
                    STATE_HASH=NULL, SESSION_HASH=NULL, STATE_EXPIRES_AT=NULL, LAST_DELIVERY_STATUS=NULL,
                    LAST_SENT_AT=NULL WHERE ID=1
                    """, UUID.randomUUID().toString(), access, refresh, timestamp(accessExpiry), timestamp(refreshExpiry), timestamp(now), cutoff) == 1;
        });
    }
    public void disconnectOwner(Long memberId) {
        // Also usable inside account withdrawal; no MemberService dependency/cycle.
        // Local/test profiles can intentionally use Hibernate without Flyway. Production migrations always create this table.
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)>0 FROM INFORMATION_SCHEMA.TABLES WHERE LOWER(TABLE_NAME)='kakao_self_connection' AND TABLE_SCHEMA=CURRENT_SCHEMA()", Boolean.class))) return;
        // Join an existing withdrawal transaction so failure rolls back both changes.
        jdbc.queryForObject("SELECT ID FROM KAKAO_SELF_CONNECTION WHERE ID=1 FOR UPDATE", Integer.class);
        jdbc.update("""
                UPDATE KAKAO_SELF_CONNECTION SET MEMBER_ID=NULL, GENERATION=?, ACCESS_TOKEN=NULL, REFRESH_TOKEN=NULL,
                ACCESS_EXPIRES_AT=NULL, REFRESH_EXPIRES_AT=NULL, CONNECTED_AT=NULL, RECONNECT_REQUIRED=FALSE,
                STATE_HASH=NULL, SESSION_HASH=NULL, STATE_EXPIRES_AT=NULL, LAST_DELIVERY_STATUS=NULL,
                LAST_SENT_AT=NULL WHERE ID=1 AND MEMBER_ID=?
                """, UUID.randomUUID().toString(), memberId);
    }
    public void disconnect(Long memberId) { transact(() -> { lock(); disconnectOwner(memberId); return null; }); }
    private void clear() {
        jdbc.update("""
                UPDATE KAKAO_SELF_CONNECTION SET MEMBER_ID=NULL, GENERATION=?, ACCESS_TOKEN=NULL, REFRESH_TOKEN=NULL,
                ACCESS_EXPIRES_AT=NULL, REFRESH_EXPIRES_AT=NULL, CONNECTED_AT=NULL, RECONNECT_REQUIRED=FALSE,
                STATE_HASH=NULL, SESSION_HASH=NULL, STATE_EXPIRES_AT=NULL, LAST_DELIVERY_STATUS=NULL,
                LAST_SENT_AT=NULL, LAST_TEST_AT=NULL WHERE ID=1
                """, UUID.randomUUID().toString());
    }
    public String acquire(Long memberId, Instant now, boolean test) {
        return transact(() -> {
            Connection current = lock();
            if (!usable(current, memberId) || !active(memberId)) return null;
            if (current.leaseUntil() != null && current.leaseUntil().isAfter(now)) return null;
            if (test && current.lastTestAt() != null && current.lastTestAt().plusSeconds(60).isAfter(now)) return null;
            String lease = UUID.randomUUID().toString();
            jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET LEASE_ID=?, LEASE_UNTIL=?" + (test ? ", LAST_TEST_AT=?" : "") + " WHERE ID=1",
                    test ? new Object[]{lease, timestamp(now.plusSeconds(120)), timestamp(now)} : new Object[]{lease, timestamp(now.plusSeconds(120))});
            return lease;
        });
    }
    public void release(String lease) { jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET LEASE_ID=NULL, LEASE_UNTIL=NULL WHERE ID=1 AND LEASE_ID=?", lease); }
    public boolean refresh(Connection old, String lease, String access, String refresh, Instant accessExpiry, Instant refreshExpiry) {
        return jdbc.update("""
                UPDATE KAKAO_SELF_CONNECTION SET ACCESS_TOKEN=?, REFRESH_TOKEN=?, ACCESS_EXPIRES_AT=?, REFRESH_EXPIRES_AT=?
                WHERE ID=1 AND GENERATION=? AND LEASE_ID=? AND MEMBER_ID=? AND CONNECTED_AT IS NOT NULL
                """, access, refresh, timestamp(accessExpiry), timestamp(refreshExpiry), old.generation(), lease, old.memberId()) == 1;
    }
    public boolean current(Connection expected, String lease, Instant now) {
        Connection row = read();
        return usable(row, expected.memberId()) && row.generation().equals(expected.generation())
                && Objects.equals(lease, row.leaseId()) && row.leaseUntil() != null && row.leaseUntil().isAfter(now) && active(expected.memberId());
    }
    public void reconnect(Connection expected, String lease) {
        jdbc.update("""
                UPDATE KAKAO_SELF_CONNECTION SET RECONNECT_REQUIRED=TRUE, ACCESS_TOKEN=NULL, REFRESH_TOKEN=NULL,
                LAST_DELIVERY_STATUS='RECONNECT_REQUIRED' WHERE ID=1 AND GENERATION=? AND LEASE_ID=?
                """, expected.generation(), lease);
    }
    public List<Notice> candidates(Connection connection, LocalDate today) {
        return jdbc.query(CANDIDATES + " ORDER BY n.ID FETCH FIRST 20 ROWS ONLY", (rs, row) -> new Notice(rs.getLong("ID"), rs.getLong("NOTICE_ID"),
                        rs.getString("TITLE"), rs.getString("NOTIFICATION_TYPE"), rs.getDate("EVENT_DATE").toLocalDate(),
                        rs.getString("HOUSING_CATEGORY"), rs.getString("RENT_TYPE"), rs.getBigDecimal("MIN_PRICE"), rs.getBigDecimal("MAX_PRICE"),
                        rs.getBigDecimal("MIN_AREA"), rs.getBigDecimal("MAX_AREA")),
                connection.memberId(), connection.cutoffId(), timestamp(connection.connectedAt()), timestamp(today.atStartOfDay(java.time.ZoneId.of("Asia/Seoul")).toInstant()), timestamp(today.plusDays(1).atStartOfDay(java.time.ZoneId.of("Asia/Seoul")).toInstant()));
    }
    private static final String CANDIDATES = """
            SELECT n.ID, n.NOTICE_ID, s.TITLE, n.NOTIFICATION_TYPE, n.EVENT_DATE,
                   s.HOUSING_CATEGORY, s.RENT_TYPE, s.MIN_PRICE, s.MAX_PRICE,
                   (SELECT MIN(u.SUPPLY_AREA) FROM SUBSCRIPTION_NOTICE_UNIT_TYPE u WHERE u.NOTICE_ID=s.ID AND u.SUPPLY_AREA>0) AS MIN_AREA,
                   (SELECT MAX(u.SUPPLY_AREA) FROM SUBSCRIPTION_NOTICE_UNIT_TYPE u WHERE u.NOTICE_ID=s.ID AND u.SUPPLY_AREA>0) AS MAX_AREA
            FROM MEMBER_NOTIFICATION n JOIN SUBSCRIPTION_NOTICE s ON s.ID=n.NOTICE_ID
            JOIN APP_MEMBER m ON m.ID=n.MEMBER_ID
            JOIN MEMBER_FAVORITE f ON f.MEMBER_ID=n.MEMBER_ID AND f.NOTICE_ID=n.NOTICE_ID
            LEFT JOIN MEMBER_NOTIFICATION_PREFERENCE p ON p.MEMBER_ID=n.MEMBER_ID
            WHERE n.MEMBER_ID=? AND n.ID>? AND n.CREATED_AT>=? AND m.MEMBER_STATUS='ACTIVE'
            AND n.CREATED_AT>=?
            AND n.CREATED_AT<?
            AND NOT EXISTS (SELECT 1 FROM KAKAO_SELF_RECEIPT r WHERE r.NOTIFICATION_ID=n.ID)
            AND ((n.NOTIFICATION_TYPE='APPLY_START' AND COALESCE(p.APPLY_START_ENABLED,TRUE))
              OR (n.NOTIFICATION_TYPE='APPLY_DEADLINE_7D' AND COALESCE(p.DEADLINE_7D_ENABLED,TRUE))
              OR (n.NOTIFICATION_TYPE='APPLY_DEADLINE_3D' AND COALESCE(p.DEADLINE_3D_ENABLED,TRUE))
              OR (n.NOTIFICATION_TYPE='APPLY_DEADLINE_1D' AND COALESCE(p.DEADLINE_1D_ENABLED,TRUE)))
            """;
    public boolean claim(Connection expected, String lease, Long notificationId, Instant now, LocalDate today) {
        return transact(() -> {
            lock();
            if (!current(expected, lease, now)) return false;
            if (notificationId != null && candidates(expected, today).stream().noneMatch(n -> n.id().equals(notificationId))) return false;
            if (notificationId != null) jdbc.update("INSERT INTO KAKAO_SELF_RECEIPT (NOTIFICATION_ID, ATTEMPTED_AT, OUTCOME) VALUES (?,?,'UNKNOWN')", notificationId, timestamp(now));
            jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET LAST_DELIVERY_STATUS='UNKNOWN' WHERE ID=1");
            return true;
        });
    }
    public void complete(Connection expected, String lease, Long notificationId, String outcome, Instant now) {
        transact(() -> {
            if (notificationId != null) jdbc.update("UPDATE KAKAO_SELF_RECEIPT SET OUTCOME=? WHERE NOTIFICATION_ID=?", outcome, notificationId);
            jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET LAST_DELIVERY_STATUS=?" + (outcome.equals("ACCEPTED") ? ", LAST_SENT_AT=?" : "") + " WHERE ID=1 AND GENERATION=? AND LEASE_ID=?",
                    outcome.equals("ACCEPTED") ? new Object[]{outcome, timestamp(now), expected.generation(), lease} : new Object[]{outcome, expected.generation(), lease});
            return null;
        });
    }
    private boolean active(Long memberId) { return Boolean.TRUE.equals(jdbc.queryForObject("SELECT COUNT(*)>0 FROM APP_MEMBER WHERE ID=? AND MEMBER_STATUS='ACTIVE'", Boolean.class, memberId)); }
    private static boolean usable(Connection row, Long memberId) { return Objects.equals(row.memberId(), memberId) && row.connectedAt() != null && !row.reconnectRequired() && row.refreshToken() != null; }
    private static Timestamp timestamp(Instant value) { return value == null ? null : Timestamp.from(value); }
    private static Instant instant(ResultSet rs, String column) throws SQLException { Timestamp value = rs.getTimestamp(column); return value == null ? null : value.toInstant(); }
    private static Connection connection(ResultSet rs) throws SQLException {
        return new Connection(rs.getObject("MEMBER_ID", Long.class), rs.getString("GENERATION"), rs.getString("ACCESS_TOKEN"), rs.getString("REFRESH_TOKEN"),
                instant(rs,"ACCESS_EXPIRES_AT"), instant(rs,"REFRESH_EXPIRES_AT"), instant(rs,"CONNECTED_AT"), rs.getLong("CUTOFF_ID"), rs.getBoolean("RECONNECT_REQUIRED"),
                rs.getString("STATE_HASH"), rs.getString("SESSION_HASH"), instant(rs,"STATE_EXPIRES_AT"), rs.getString("LEASE_ID"), instant(rs,"LEASE_UNTIL"),
                instant(rs,"LAST_TEST_AT"), instant(rs,"LAST_SENT_AT"), rs.getString("LAST_DELIVERY_STATUS"));
    }
    public record Connection(Long memberId, String generation, String accessToken, String refreshToken, Instant accessExpiresAt, Instant refreshExpiresAt,
            Instant connectedAt, long cutoffId, boolean reconnectRequired, String stateHash, String sessionHash, Instant stateExpiresAt,
            String leaseId, Instant leaseUntil, Instant lastTestAt, Instant lastSentAt, String lastDeliveryStatus) {
        @Override public String toString() { return "KakaoSelfConnection[redacted]"; }
    }
    public record Notice(Long id, Long noticeId, String title, String type, LocalDate eventDate,
                         String housingCategory, String rentType, BigDecimal minPrice, BigDecimal maxPrice,
                         BigDecimal minArea, BigDecimal maxArea) {}
}
