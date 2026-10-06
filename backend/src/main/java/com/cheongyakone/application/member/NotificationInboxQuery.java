package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotification;
import com.cheongyakone.domain.member.NotificationType;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import jakarta.persistence.criteria.Predicate;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Locale;

/** Date bounds refer to the received date in Korea, not the scheduled event date. */
public record NotificationInboxQuery(String query, Filter filter, Order sort, ReadStatus readStatus,
                                     LocalDate from, LocalDate to, int page, int size, Long snapshotId) {
    public enum Filter { ALL, UNREAD, SCHEDULE, NEW, UPDATED }
    public enum Order { NEWEST, UNREAD_FIRST }
    public enum ReadStatus { ALL, UNREAD, READ }
    public NotificationInboxQuery {
        query = query == null ? "" : Normalizer.normalize(query, Normalizer.Form.NFKC).strip().toLowerCase(Locale.ROOT);
        if (query.length() > 100 || page < 0 || page > 100000 || size < 1 || size > 50
                || (snapshotId != null && snapshotId < 0) || (from != null && to != null && from.isAfter(to))
                || (from != null && (from.getYear() < 1900 || from.getYear() > 9999))
                || (to != null && (to.getYear() < 1900 || to.getYear() > 9999))) {
            throw new MemberApiException(HttpStatus.BAD_REQUEST, "INVALID_NOTIFICATION_QUERY", "알림 검색 조건과 기간을 확인해주세요.");
        }
    }
    public static NotificationInboxQuery defaults() {
        return new NotificationInboxQuery("", Filter.ALL, Order.NEWEST, ReadStatus.ALL, null, null, 0, 50, null);
    }
    public Specification<MemberNotification> specification(Long memberId, long snapshot) {
        return (root, criteria, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("member").get("id"), memberId));
            predicates.add(cb.le(root.get("id"), snapshot));
            if (filter == Filter.UNREAD || readStatus == ReadStatus.UNREAD) predicates.add(cb.isNull(root.get("readAt")));
            if (readStatus == ReadStatus.READ) predicates.add(cb.isNotNull(root.get("readAt")));
            if (filter == Filter.NEW) predicates.add(cb.equal(root.get("type"), NotificationType.NEW_MATCHING_NOTICE));
            if (filter == Filter.UPDATED) predicates.add(cb.equal(root.get("type"), NotificationType.NOTICE_UPDATED));
            if (filter == Filter.SCHEDULE) predicates.add(cb.not(root.get("type").in(NotificationType.NEW_MATCHING_NOTICE, NotificationType.NOTICE_UPDATED)));
            var zone = ZoneId.of("Asia/Seoul");
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay(zone).toInstant()));
            if (to != null) predicates.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay(zone).toInstant()));
            for (String term : query.split("\\s+")) {
                if (term.isEmpty()) continue;
                String escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                var title = cb.like(cb.lower(root.get("notice").get("title")), "%" + escaped + "%", '\\');
                var matchingTypes = Arrays.stream(NotificationType.values()).filter(type -> type.message().toLowerCase(Locale.ROOT).contains(term)).toList();
                predicates.add(matchingTypes.isEmpty() ? title : cb.or(title, root.get("type").in(matchingTypes)));
            }
            if (criteria.getResultType() != Long.class && criteria.getResultType() != long.class) {
                var orders = new ArrayList<jakarta.persistence.criteria.Order>();
                if (sort == Order.UNREAD_FIRST) orders.add(cb.asc(cb.<Integer>selectCase().when(cb.isNull(root.get("readAt")), 0).otherwise(1)));
                orders.add(cb.desc(root.get("createdAt")));
                orders.add(cb.desc(root.get("id")));
                criteria.orderBy(orders);
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
