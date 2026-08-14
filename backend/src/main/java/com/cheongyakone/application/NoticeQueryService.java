package com.cheongyakone.application;

import com.cheongyakone.api.NoticeSummaryResponse;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@Transactional(readOnly = true)
public class NoticeQueryService {

    private final SubscriptionNoticeRepository noticeRepository;

    public NoticeQueryService(SubscriptionNoticeRepository noticeRepository) {
        this.noticeRepository = noticeRepository;
    }

    public Page<NoticeSummaryResponse> findNotices(
            HousingCategory category,
            NoticeStatus status,
            String keyword,
            String region,
            int page,
            int size
    ) {
        var pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Order.asc("applyEndDate"), Sort.Order.desc("noticeDate"))
        );

        // Spring Data JPA 4부터 null Specification 조합이 허용되지 않아 실제 조건만 순서대로 추가한다.
        Specification<SubscriptionNotice> specification = Specification.unrestricted();
        if (category != null) {
            specification = specification.and(
                    (root, query, cb) -> cb.equal(root.get("housingCategory"), category)
            );
        }
        if (status != null) {
            specification = specification.and(
                    (root, query, cb) -> cb.equal(root.get("status"), status)
            );
        }
        if (StringUtils.hasText(keyword)) {
            String pattern = "%" + keyword.trim().toLowerCase() + "%";
            specification = specification.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("title")), pattern),
                    cb.like(cb.lower(root.get("address")), pattern)
            ));
        }
        if (StringUtils.hasText(region)) {
            String normalizedRegion = region.trim().toLowerCase();
            specification = specification.and((root, query, cb) -> cb.or(
                    cb.equal(cb.lower(root.get("regionCode")), normalizedRegion),
                    cb.like(cb.lower(root.get("address")), normalizedRegion + "%")
            ));
        }

        return noticeRepository.findAll(specification, pageable).map(NoticeSummaryResponse::from);
    }

    public NoticeSummaryResponse findById(Long id) {
        return noticeRepository.findById(id)
                .map(NoticeSummaryResponse::from)
                .orElseThrow(() -> new NoticeNotFoundException(id));
    }
}
