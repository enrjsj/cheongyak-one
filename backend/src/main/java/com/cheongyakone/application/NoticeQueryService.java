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
            int page,
            int size
    ) {
        var pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Order.asc("applyEndDate"), Sort.Order.desc("noticeDate"))
        );

        Specification<SubscriptionNotice> specification = Specification.allOf(
                category == null ? null : (root, query, cb) -> cb.equal(root.get("housingCategory"), category),
                status == null ? null : (root, query, cb) -> cb.equal(root.get("status"), status),
                !StringUtils.hasText(keyword) ? null : (root, query, cb) ->
                        cb.like(cb.lower(root.get("title")), "%" + keyword.trim().toLowerCase() + "%")
        );

        return noticeRepository.findAll(specification, pageable).map(NoticeSummaryResponse::from);
    }

    public NoticeSummaryResponse findById(Long id) {
        return noticeRepository.findById(id)
                .map(NoticeSummaryResponse::from)
                .orElseThrow(() -> new NoticeNotFoundException(id));
    }
}
