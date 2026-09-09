package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberFavoriteRepository;
import com.cheongyakone.domain.member.MemberNotificationPreference;
import com.cheongyakone.domain.member.MemberNotificationPreferenceRepository;
import com.cheongyakone.domain.member.MemberNotificationRepository;
import com.cheongyakone.domain.member.MemberSearchPreferenceRepository;
import com.cheongyakone.domain.member.NotificationType;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MemberNotificationGenerator {

    private static final Logger log = LoggerFactory.getLogger(MemberNotificationGenerator.class);
    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");

    private final MemberFavoriteRepository favoriteRepository;
    private final MemberNotificationPreferenceRepository preferenceRepository;
    private final MemberSearchPreferenceRepository searchPreferenceRepository;
    private final SubscriptionNoticeRepository noticeRepository;
    private final MemberNotificationRepository notificationRepository;
    private final MemberNotificationWriter notificationWriter;
    private final Clock clock;

    public MemberNotificationGenerator(
            MemberFavoriteRepository favoriteRepository,
            MemberNotificationPreferenceRepository preferenceRepository,
            MemberSearchPreferenceRepository searchPreferenceRepository,
            SubscriptionNoticeRepository noticeRepository,
            MemberNotificationRepository notificationRepository,
            MemberNotificationWriter notificationWriter,
            Clock clock
    ) {
        this.favoriteRepository = favoriteRepository;
        this.preferenceRepository = preferenceRepository;
        this.searchPreferenceRepository = searchPreferenceRepository;
        this.noticeRepository = noticeRepository;
        this.notificationRepository = notificationRepository;
        this.notificationWriter = notificationWriter;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.member-notification.cron}", zone = "${app.member-notification.zone}")
    public void generateScheduledNotifications() {
        LocalDate today = LocalDate.now(clock.withZone(KOREA_ZONE));
        int createdCount = generateFor(today) + generateMatchingFor(today) + generateUpdatedFor(today);
        log.info("Member notification generation completed: date={}, created={}", today, createdCount);
    }

    @Scheduled(cron = "${app.member-notification.cleanup-cron}", zone = "${app.member-notification.zone}")
    @Transactional
    public void deleteOldReadNotifications() {
        notificationRepository.deleteByReadAtBefore(clock.instant().minus(java.time.Duration.ofDays(90)));
    }

    public int generateFor(LocalDate today) {
        return generateFavoriteNotifications(today);
    }

    private int generateFavoriteNotifications(LocalDate today) {
        var favorites = favoriteRepository.findNotificationCandidates(
                today,
                List.of(today.plusDays(1), today.plusDays(3), today.plusDays(7))
        );
        if (favorites.isEmpty()) {
            return 0;
        }
        Set<Long> memberIds = favorites.stream()
                .map(favorite -> favorite.getMember().getId())
                .collect(Collectors.toSet());
        Map<Long, NotificationSettings> settingsByMember = new HashMap<>();
        for (MemberNotificationPreference preference : preferenceRepository.findAllByMemberIdIn(memberIds)) {
            settingsByMember.put(preference.getMemberId(), NotificationSettings.from(preference));
        }

        Instant now = clock.instant();
        int createdCount = 0;
        for (var favorite : favorites) {
            if (!favorite.getMember().isActive()) {
                continue;
            }
            NotificationSettings settings = settingsByMember.getOrDefault(
                    favorite.getMember().getId(),
                    NotificationSettings.defaults()
            );
            for (NotificationEvent event : eventsFor(favorite.getNotice(), settings, today)) {
                try {
                    if (notificationWriter.createIfMissing(
                            favorite.getMember().getId(),
                            favorite.getNoticeId(),
                            event.type(),
                            event.eventDate(),
                            now,
                            settings.emailEnabled()
                    )) {
                        createdCount += 1;
                    }
                } catch (DataIntegrityViolationException exception) {
                    // 여러 인스턴스가 동시에 생성해도 유니크 제약으로 한 건만 남긴다.
                    log.warn(
                            "Member notification insert conflicted: memberId={}, noticeId={}, type={}",
                            favorite.getMember().getId(),
                            favorite.getNoticeId(),
                            event.type(),
                            exception
                    );
                }
            }
        }
        return createdCount;
    }

    public int generateMatchingFor(LocalDate today) {
        Instant dayStart = today.atStartOfDay(KOREA_ZONE).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(KOREA_ZONE).toInstant();
        var notices = noticeRepository.findAllByFirstSeenAtGreaterThanEqualAndFirstSeenAtLessThan(dayStart, dayEnd);
        var searchPreferences = searchPreferenceRepository.findAllForNotification();
        if (notices.isEmpty() || searchPreferences.isEmpty()) {
            return 0;
        }

        Set<Long> memberIds = searchPreferences.stream()
                .map(preference -> preference.getMemberId())
                .collect(Collectors.toSet());
        Map<Long, NotificationSettings> settingsByMember = new HashMap<>();
        for (MemberNotificationPreference preference : preferenceRepository.findAllByMemberIdIn(memberIds)) {
            settingsByMember.put(preference.getMemberId(), NotificationSettings.from(preference));
        }

        Instant now = clock.instant();
        int createdCount = 0;
        for (var searchPreference : searchPreferences) {
            if (!searchPreference.isMemberActive()) {
                continue;
            }
            NotificationSettings settings = settingsByMember.getOrDefault(
                    searchPreference.getMemberId(),
                    NotificationSettings.defaults()
            );
            if (!settings.newMatchingNoticeEnabled()) {
                continue;
            }
            for (SubscriptionNotice notice : notices) {
                if (!MemberNoticePreferenceMatcher.matches(notice, searchPreference, today)) {
                    continue;
                }
                try {
                    if (notificationWriter.createIfMissing(
                            searchPreference.getMemberId(),
                            notice.getId(),
                            NotificationType.NEW_MATCHING_NOTICE,
                            today,
                            now,
                            settings.emailEnabled()
                    )) {
                        createdCount += 1;
                    }
                } catch (DataIntegrityViolationException exception) {
                    log.warn(
                            "Matching notice notification insert conflicted: memberId={}, noticeId={}",
                            searchPreference.getMemberId(),
                            notice.getId(),
                            exception
                    );
                }
            }
        }
        return createdCount;
    }

    public int generateUpdatedFor(LocalDate today) {
        Instant dayStart = today.atStartOfDay(KOREA_ZONE).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(KOREA_ZONE).toInstant();
        var favorites = favoriteRepository.findUpdatedNotificationCandidates(dayStart, dayEnd);
        if (favorites.isEmpty()) {
            return 0;
        }

        Set<Long> memberIds = favorites.stream()
                .map(favorite -> favorite.getMember().getId())
                .collect(Collectors.toSet());
        Map<Long, NotificationSettings> settingsByMember = new HashMap<>();
        for (MemberNotificationPreference preference : preferenceRepository.findAllByMemberIdIn(memberIds)) {
            settingsByMember.put(preference.getMemberId(), NotificationSettings.from(preference));
        }

        Instant now = clock.instant();
        int createdCount = 0;
        for (var favorite : favorites) {
            if (!favorite.getMember().isActive()) {
                continue;
            }
            NotificationSettings settings = settingsByMember.getOrDefault(
                    favorite.getMember().getId(),
                    NotificationSettings.defaults()
            );
            if (!settings.noticeUpdatedEnabled()) {
                continue;
            }
            try {
                if (notificationWriter.createIfMissing(
                        favorite.getMember().getId(),
                        favorite.getNoticeId(),
                        NotificationType.NOTICE_UPDATED,
                        today,
                        now,
                        settings.emailEnabled()
                )) {
                    createdCount += 1;
                }
            } catch (DataIntegrityViolationException exception) {
                log.warn(
                        "Updated notice notification insert conflicted: memberId={}, noticeId={}",
                        favorite.getMember().getId(),
                        favorite.getNoticeId(),
                        exception
                );
            }
        }
        return createdCount;
    }

    private List<NotificationEvent> eventsFor(
            SubscriptionNotice notice,
            NotificationSettings settings,
            LocalDate today
    ) {
        List<NotificationEvent> events = new ArrayList<>();
        if (settings.applyStartEnabled() && today.equals(notice.getApplyStartDate())) {
            events.add(new NotificationEvent(NotificationType.APPLY_START, notice.getApplyStartDate()));
        }
        addDeadlineEvent(events, settings.deadline7dEnabled(), notice.getApplyEndDate(), today, 7,
                NotificationType.APPLY_DEADLINE_7D);
        addDeadlineEvent(events, settings.deadline3dEnabled(), notice.getApplyEndDate(), today, 3,
                NotificationType.APPLY_DEADLINE_3D);
        addDeadlineEvent(events, settings.deadline1dEnabled(), notice.getApplyEndDate(), today, 1,
                NotificationType.APPLY_DEADLINE_1D);
        if (settings.winnerEnabled() && today.equals(notice.getWinnerAnnounceDate())) {
            events.add(new NotificationEvent(NotificationType.WINNER_ANNOUNCEMENT, notice.getWinnerAnnounceDate()));
        }
        return events;
    }

    private void addDeadlineEvent(
            List<NotificationEvent> events,
            boolean enabled,
            LocalDate deadline,
            LocalDate today,
            int daysBefore,
            NotificationType type
    ) {
        if (enabled && deadline != null && today.plusDays(daysBefore).equals(deadline)) {
            events.add(new NotificationEvent(type, deadline));
        }
    }

    private record NotificationEvent(NotificationType type, LocalDate eventDate) {
    }

    private record NotificationSettings(
            boolean applyStartEnabled,
            boolean deadline7dEnabled,
            boolean deadline3dEnabled,
            boolean deadline1dEnabled,
            boolean winnerEnabled,
            boolean newMatchingNoticeEnabled,
            boolean noticeUpdatedEnabled,
            boolean emailEnabled
    ) {
        static NotificationSettings defaults() {
            return new NotificationSettings(true, true, true, true, true, true, true, false);
        }

        static NotificationSettings from(MemberNotificationPreference preference) {
            return new NotificationSettings(
                    preference.isApplyStartEnabled(),
                    preference.isDeadline7dEnabled(),
                    preference.isDeadline3dEnabled(),
                    preference.isDeadline1dEnabled(),
                    preference.isWinnerEnabled(),
                    preference.isNewMatchingNoticeEnabled(),
                    preference.isNoticeUpdatedEnabled(),
                    preference.isEmailEnabled()
            );
        }
    }
}
