package com.cheongyakone.application.member;

import com.cheongyakone.config.KakaoSelfProperties;
import com.cheongyakone.infrastructure.kakao.KakaoSelfClient;
import com.cheongyakone.infrastructure.kakao.KakaoSelfTokenCipher;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Objects;

@Service
public class KakaoSelfService {
    private final KakaoSelfProperties properties;
    private final MemberService members;
    private final KakaoSelfStore store;
    private final KakaoSelfClient client;
    private final KakaoSelfTokenCipher cipher;
    private final Clock clock;
    private final MemberNotificationGenerator notifications;
    public KakaoSelfService(KakaoSelfProperties properties, MemberService members, KakaoSelfStore store,
            KakaoSelfClient client, KakaoSelfTokenCipher cipher, Clock clock, MemberNotificationGenerator notifications) {
        this.properties=properties; this.members=members; this.store=store; this.client=client; this.cipher=cipher; this.clock=clock; this.notifications=notifications;
    }
    public Status status(String rawSession) {
        Long memberId = members.requireMember(rawSession).getId();
        boolean eligible = Objects.equals(memberId, properties.ownerMemberId());
        if (!eligible) return new Status(false, false, false, false, "운영자로 지정한 계정만 사용할 수 있어요.", null, null);
        if (!properties.enabled()) return new Status(true, false, false, false, "카카오 앱과 서버 연결 설정을 준비 중이에요.", null, null);
        var row = store.read();
        if (!Objects.equals(memberId, row.memberId()) || row.connectedAt() == null) return new Status(true, true, false, false, "내 카카오 계정을 연결하면 새 관심 공고 일정 알림을 나와의 채팅방으로 보내요.", null, null);
        boolean expired = row.reconnectRequired() || row.refreshExpiresAt() == null || !row.refreshExpiresAt().isAfter(clock.instant());
        String outcome = row.lastDeliveryStatus();
        String message = expired ? "카카오 연결이 만료됐어요. 다시 연결해주세요."
                : "UNKNOWN".equals(outcome) ? "최근 발송 결과를 확인하지 못했어요. 중복 방지를 위해 자동 재발송하지 않아요."
                : outcome != null && !outcome.equals("ACCEPTED") ? "최근 발송에 실패했어요. 카카오 설정과 연결 상태를 확인해주세요."
                : "새로 생성되는 접수 시작·마감 임박 알림을 나와의 채팅방으로 보내요.";
        return new Status(true, true, !expired, expired, message, row.lastSentAt(), "ACCEPTED".equals(outcome) ? "SENT" : outcome);
    }
    public String authorize(String rawSession) {
        Long memberId = owner(rawSession);
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        store.begin(memberId, hash(state), hash(rawSession), clock.instant().plusSeconds(600));
        return UriComponentsBuilder.fromUriString("https://kauth.kakao.com/oauth/authorize")
                .queryParam("response_type","code").queryParam("client_id",properties.restApiKey())
                .queryParam("redirect_uri",properties.redirectUri()).queryParam("scope","talk_message")
                .queryParam("state",state).build().encode().toUriString();
    }
    public String callback(String rawSession, String state, String code, String error) {
        try {
            Long memberId = owner(rawSession);
            if (state == null || state.length() > 128) return "error";
            String generation = store.consumeState(memberId, hash(state), hash(rawSession), clock.instant());
            if (generation == null) return "error";
            if (error != null) return error.equals("access_denied") ? "cancelled" : "error";
            if (code == null || code.isBlank() || code.length() > 2048) return "error";
            var tokens = client.exchange(code);
            Instant now = clock.instant();
            boolean saved = store.connect(memberId, generation, cipher.encrypt(tokens.accessToken()), cipher.encrypt(tokens.refreshToken()),
                    now.plusSeconds(tokens.expiresIn()), now.plusSeconds(tokens.refreshExpiresIn()), now);
            return saved ? "connected" : "error";
        } catch (RuntimeException exception) {
            // Never return or log provider payloads, authorization codes, sessions or tokens.
            return "error";
        }
    }
    public void disconnect(String rawSession) { Long memberId = owner(rawSession); store.disconnect(memberId); }
    public Status test(String rawSession) {
        Long memberId = owner(rawSession);
        var status = status(rawSession);
        if (!status.connected()) throw failure(HttpStatus.CONFLICT, "KAKAO_RECONNECT_REQUIRED", "먼저 카카오 계정을 연결해주세요.");
        String lease = store.acquire(memberId, clock.instant(), true);
        if (lease == null) throw failure(HttpStatus.TOO_MANY_REQUESTS, "KAKAO_SEND_BUSY", "발송 중이거나 최근 테스트를 보냈어요. 잠시 후 다시 시도해주세요.");
        boolean accepted;
        try { accepted = deliver(store.read(), lease, null, "청약한눈 연결 확인\n앞으로 관심 공고의 접수 시작과 마감 임박 알림을 이 채팅방으로 보내드려요.", properties.frontendBaseUrl(), today()); }
        finally { store.release(lease); }
        if (!accepted) throw failure(HttpStatus.CONFLICT, "KAKAO_TEST_NOT_ACCEPTED", "이번 시험 메시지 발송을 확인하지 못했어요. 연결 상태를 새로고침해주세요.");
        return status(rawSession);
    }
    @Scheduled(cron="0 0 9 * * *", zone="Asia/Seoul")
    public void scheduled() {
        if (!properties.enabled()) return;
        LocalDate batchDate = today();
        String lease = store.acquire(properties.ownerMemberId(), clock.instant(), false);
        if (lease == null) return;
        try {
            var row = store.read();
            if (!store.current(row, lease, clock.instant())) return;
            // Create due events first; the inbox's hourly scheduler must not race delivery.
            notifications.generateKakaoForMember(batchDate, properties.ownerMemberId());
            while (store.current(row, lease, clock.instant()) && today().equals(batchDate)) {
                var candidates = store.candidates(row, batchDate);
                if (candidates.isEmpty()) break;
                for (var notice : candidates) {
                    if (!store.current(row, lease, clock.instant()) || !today().equals(batchDate)) return;
                    String text = KakaoSelfMessage.format(notice);
                    if (!deliver(row, lease, notice.id(), text, properties.frontendBaseUrl() + "/?notice=" + notice.noticeId(), batchDate)) return;
                }
            }
        } finally { store.release(lease); }
    }

    private boolean deliver(KakaoSelfStore.Connection row, String lease, Long notificationId, String text, String url, LocalDate deliveryDate) {
        if (!store.current(row, lease, clock.instant())) return false;
        String access;
        try {
            access = accessToken(row, lease);
        } catch (KakaoSelfClient.Failure exception) {
            if (exception.outcome().equals("RECONNECT_REQUIRED")) store.reconnect(row, lease);
            else store.complete(row, lease, null, exception.outcome(), clock.instant());
            return false;
        } catch (IllegalStateException exception) { store.reconnect(row, lease); return false; }
        if (!store.claim(row, lease, notificationId, clock.instant(), deliveryDate)) return false;
        String outcome = "ACCEPTED";
        try { client.send(access, text, url); }
        catch (KakaoSelfClient.Failure exception) { outcome = exception.outcome(); }
        // Claim is already committed. A crash or an uncertain response remains UNKNOWN, never auto-retried.
        store.complete(row, lease, notificationId, outcome, clock.instant());
        if (outcome.equals("RECONNECT_REQUIRED")) store.reconnect(row, lease);
        return outcome.equals("ACCEPTED");
    }
    private String accessToken(KakaoSelfStore.Connection expected, String lease) {
        var row = store.read();
        if (!store.current(expected, lease, clock.instant())) throw new KakaoSelfClient.Failure("RECONNECT_REQUIRED");
        if (row.refreshExpiresAt() == null || !row.refreshExpiresAt().isAfter(clock.instant())) throw new KakaoSelfClient.Failure("RECONNECT_REQUIRED");
        if (row.accessExpiresAt() != null && row.accessExpiresAt().isAfter(clock.instant().plusSeconds(60))) return cipher.decrypt(row.accessToken());
        var tokens = client.refresh(cipher.decrypt(row.refreshToken()));
        Instant now = clock.instant();
        String refresh = tokens.refreshToken().isBlank() ? row.refreshToken() : cipher.encrypt(tokens.refreshToken());
        Instant refreshExpiry = tokens.refreshToken().isBlank() ? row.refreshExpiresAt() : now.plusSeconds(tokens.refreshExpiresIn());
        if (!store.refresh(row, lease, cipher.encrypt(tokens.accessToken()), refresh, now.plusSeconds(tokens.expiresIn()), refreshExpiry)) throw new KakaoSelfClient.Failure("RECONNECT_REQUIRED");
        return tokens.accessToken();
    }
    private Long owner(String session) {
        Long id = members.requireMember(session).getId();
        if (!Objects.equals(id, properties.ownerMemberId())) throw failure(HttpStatus.FORBIDDEN,"KAKAO_OWNER_ONLY","운영자로 지정한 계정만 사용할 수 있어요.");
        if (!properties.enabled()) throw failure(HttpStatus.SERVICE_UNAVAILABLE,"KAKAO_NOT_CONFIGURED","카카오 연결 설정을 준비 중이에요.");
        return id;
    }
    private LocalDate today() { return LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul"))); }
    private static String hash(String value) { return MemberPushReceiptStore.hash(value); }
    private static MemberApiException failure(HttpStatus status, String code, String message) { return new MemberApiException(status,code,message); }
    public record Status(boolean eligible, boolean configured, boolean connected, boolean reconnectRequired, String message, Instant lastSentAt, String lastDeliveryStatus) {}
}
