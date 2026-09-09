package com.cheongyakone.application.member;

import com.cheongyakone.config.MemberMailProperties;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.domain.member.MemberActionToken;
import com.cheongyakone.domain.member.MemberActionTokenRepository;
import com.cheongyakone.domain.member.MemberActionTokenType;
import com.cheongyakone.domain.member.MemberLoginSessionRepository;
import com.cheongyakone.domain.member.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@Service
public class MemberAccountRecoveryService {

    private static final Logger log = LoggerFactory.getLogger(MemberAccountRecoveryService.class);
    private static final Duration VERIFICATION_VALIDITY = Duration.ofHours(24);
    private static final Duration PASSWORD_RESET_VALIDITY = Duration.ofMinutes(30);
    private static final Duration REQUEST_COOLDOWN = Duration.ofMinutes(2);

    private final MemberRepository memberRepository;
    private final MemberActionTokenRepository tokenRepository;
    private final MemberLoginSessionRepository sessionRepository;
    private final MemberMailSender mailSender;
    private final MemberMailProperties properties;
    private final SessionTokenCodec tokenCodec;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public MemberAccountRecoveryService(
            MemberRepository memberRepository,
            MemberActionTokenRepository tokenRepository,
            MemberLoginSessionRepository sessionRepository,
            MemberMailSender mailSender,
            MemberMailProperties properties,
            SessionTokenCodec tokenCodec,
            PasswordEncoder passwordEncoder,
            Clock clock
    ) {
        this.memberRepository = memberRepository;
        this.tokenRepository = tokenRepository;
        this.sessionRepository = sessionRepository;
        this.mailSender = mailSender;
        this.properties = properties;
        this.tokenCodec = tokenCodec;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @Transactional
    public void prepareSignup(Member member) {
        if (!properties.verificationRequired()) {
            member.verifyEmail(clock.instant());
            return;
        }
        issue(member, MemberActionTokenType.EMAIL_VERIFICATION, VERIFICATION_VALIDITY);
    }

    @Transactional
    public void requestEmailVerification(String email) {
        memberRepository.findForAuthentication(Member.normalizeEmail(email))
                .filter(Member::isActive)
                .filter(member -> !member.isEmailVerified())
                .ifPresent(member -> issue(member, MemberActionTokenType.EMAIL_VERIFICATION, VERIFICATION_VALIDITY));
    }

    @Transactional
    public void confirmEmailVerification(String rawToken) {
        Instant now = clock.instant();
        MemberActionToken token = usableToken(rawToken, MemberActionTokenType.EMAIL_VERIFICATION, now);
        token.getMember().verifyEmail(now);
        tokenRepository.deleteByMemberIdAndType(token.getMember().getId(), MemberActionTokenType.EMAIL_VERIFICATION);
    }

    @Transactional
    public void requestPasswordReset(String email) {
        memberRepository.findForAuthentication(Member.normalizeEmail(email))
                .filter(Member::isActive)
                .filter(Member::isEmailVerified)
                .ifPresent(member -> issue(member, MemberActionTokenType.PASSWORD_RESET, PASSWORD_RESET_VALIDITY));
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        validateNewPassword(newPassword);
        Instant now = clock.instant();
        MemberActionToken token = usableToken(rawToken, MemberActionTokenType.PASSWORD_RESET, now);
        Member member = token.getMember();
        if (passwordEncoder.matches(newPassword, member.getPasswordHash())) {
            throw new MemberApiException(HttpStatus.BAD_REQUEST, "PASSWORD_UNCHANGED", "새 비밀번호를 다르게 입력해주세요.");
        }
        member.changePassword(passwordEncoder.encode(newPassword), now);
        sessionRepository.deleteByMemberId(member.getId());
        tokenRepository.deleteByMemberId(member.getId());
    }

    @Scheduled(cron = "0 20 4 * * *", zone = "Asia/Seoul")
    @Transactional
    public void deleteExpiredTokens() {
        tokenRepository.deleteByExpiresAtBefore(clock.instant());
    }

    private void issue(Member member, MemberActionTokenType type, Duration validity) {
        Instant now = clock.instant();
        if (tokenRepository.findByMemberIdAndType(member.getId(), type)
                .filter(token -> token.getCreatedAt().plus(REQUEST_COOLDOWN).isAfter(now))
                .isPresent()) {
            return;
        }
        String rawToken = tokenCodec.createRawToken();
        tokenRepository.deleteByMemberIdAndType(member.getId(), type);
        tokenRepository.flush();
        tokenRepository.save(new MemberActionToken(
                member,
                type,
                tokenCodec.hash(rawToken),
                now.plus(validity),
                now
        ));
        afterCommit(() -> send(member.getEmail(), type, rawToken));
    }

    private MemberActionToken usableToken(String rawToken, MemberActionTokenType type, Instant now) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 200) {
            throw invalidToken();
        }
        return tokenRepository.findUsableForUpdate(tokenCodec.hash(rawToken), type, now)
                .filter(token -> token.getMember().isActive())
                .orElseThrow(this::invalidToken);
    }

    private void send(String email, MemberActionTokenType type, String rawToken) {
        try {
            if (type == MemberActionTokenType.EMAIL_VERIFICATION) {
                mailSender.sendEmailVerification(email, properties.frontendBaseUrl() + "/?verifyEmail=" + rawToken);
            } else {
                mailSender.sendPasswordReset(email, properties.frontendBaseUrl() + "/?resetPassword=" + rawToken);
            }
        } catch (RuntimeException exception) {
            log.error("Member email delivery failed for type {}", type, exception);
        }
    }

    private void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }

    private void validateNewPassword(String password) {
        if (password == null || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new MemberApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_PASSWORD",
                    "비밀번호는 8자 이상, UTF-8 기준 72바이트 이하로 입력해주세요."
            );
        }
    }

    private MemberApiException invalidToken() {
        return new MemberApiException(
                HttpStatus.BAD_REQUEST,
                "INVALID_OR_EXPIRED_TOKEN",
                "링크가 올바르지 않거나 만료되었습니다."
        );
    }
}
