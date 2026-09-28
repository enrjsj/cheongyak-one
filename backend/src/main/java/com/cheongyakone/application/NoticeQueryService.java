package com.cheongyakone.application;

import com.cheongyakone.api.NoticeDetailResponse;
import com.cheongyakone.api.NoticeChangeResponse;
import com.cheongyakone.api.NoticeSearchFacetsResponse;
import com.cheongyakone.api.NoticeSummaryResponse;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeChangeHistoryRepository;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import com.cheongyakone.domain.notice.SubscriptionNoticeUnitTypeRepository;
import com.cheongyakone.domain.notice.SupplyType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class NoticeQueryService {

    private final SubscriptionNoticeRepository noticeRepository;
    private final NoticeChangeHistoryRepository changeHistoryRepository;
    private final SubscriptionNoticeUnitTypeRepository unitTypeRepository;
    private final Clock clock;

    public NoticeQueryService(SubscriptionNoticeRepository noticeRepository, NoticeChangeHistoryRepository changeHistoryRepository, SubscriptionNoticeUnitTypeRepository unitTypeRepository, Clock clock) {
        this.noticeRepository = noticeRepository;
        this.changeHistoryRepository = changeHistoryRepository;
        this.unitTypeRepository = unitTypeRepository;
        this.clock = clock;
    }

    public Page<NoticeSummaryResponse> findNotices(
            HousingCategory category,
            SupplyType supplyType,
            NoticeStatus status,
            String keyword,
            String region,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            List<Long> ids,
            boolean endingToday,
            boolean activeOnly,
            String sort,
            int page,
            int size
    ) {
        var pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                sortFor(sort)
        );

        Specification<SubscriptionNotice> specification = searchSpecification(category, supplyType, keyword, region, minPrice, maxPrice);
        if (status != null) {
            specification = specification.and(
                    (root, query, cb) -> cb.equal(root.get("status"), status)
            );
        }
        if (activeOnly && status == null && !endingToday) {
            specification = specification.and((root, query, cb) -> root.get("status").in(
                    NoticeStatus.OPEN,
                    NoticeStatus.UPCOMING
            ));
        }
        if (ids != null && !ids.isEmpty()) {
            List<Long> safeIds = ids.stream().filter(id -> id != null && id > 0).distinct().limit(100).toList();
            specification = specification.and((root, query, cb) -> root.get("id").in(safeIds));
        }
        if (endingToday) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("applyEndDate"), LocalDate.now(clock)));
        }

        return noticeRepository.findAll(specification, pageable).map(NoticeSummaryResponse::from);
    }

    private Sort sortFor(String sort) {
        return switch (sort == null ? "" : sort.toUpperCase()) {
            case "APPLY_START" -> Sort.by(Sort.Order.asc("applyStartDate").nullsLast(), Sort.Order.desc("noticeDate"), Sort.Order.desc("id"));
            case "WINNER_ANNOUNCEMENT" -> Sort.by(Sort.Order.asc("winnerAnnounceDate").nullsLast(), Sort.Order.desc("noticeDate"), Sort.Order.desc("id"));
            case "PRICE_ASC" -> Sort.by(Sort.Order.asc("minPrice").nullsLast(), Sort.Order.desc("noticeDate"), Sort.Order.desc("id"));
            case "SUPPLY_DESC" -> Sort.by(Sort.Order.desc("totalUnits").nullsLast(), Sort.Order.desc("noticeDate"), Sort.Order.desc("id"));
            case "LATEST" -> Sort.by(Sort.Order.desc("noticeDate"), Sort.Order.desc("id"));
            default -> Sort.by(Sort.Order.asc("applyEndDate").nullsLast(), Sort.Order.desc("noticeDate"), Sort.Order.desc("id"));
        };
    }

    public NoticeSearchFacetsResponse findFacets(HousingCategory category, SupplyType supplyType, String keyword, String region, BigDecimal minPrice, BigDecimal maxPrice) {
        Specification<SubscriptionNotice> base = searchSpecification(category, supplyType, keyword, region, minPrice, maxPrice);
        long total = noticeRepository.count(base);
        long endingToday = noticeRepository.count(base.and(
                (root, query, cb) -> cb.equal(root.get("applyEndDate"), LocalDate.now(clock))));
        long open = noticeRepository.count(base.and(
                (root, query, cb) -> cb.equal(root.get("status"), NoticeStatus.OPEN)));
        long upcoming = noticeRepository.count(base.and(
                (root, query, cb) -> cb.equal(root.get("status"), NoticeStatus.UPCOMING)));
        return new NoticeSearchFacetsResponse(total, endingToday, open, upcoming);
    }

    private Specification<SubscriptionNotice> searchSpecification(HousingCategory category, SupplyType supplyType, String keyword, String region, BigDecimal minPrice, BigDecimal maxPrice) {
        // Spring Data JPA 4부터 null Specification 조합이 허용되지 않아 실제 조건만 순서대로 추가한다.
        Specification<SubscriptionNotice> specification = Specification.unrestricted();
        if (category != null) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("housingCategory"), category));
        }
        if (supplyType == SupplyType.SALE) {
            // 현재 수집 범위에서 아파트·오피스텔은 분양 청약 공고다.
            specification = specification.and((root, query, cb) -> root.get("housingCategory").in(
                    HousingCategory.APARTMENT,
                    HousingCategory.OFFICETEL
            ));
        } else if (supplyType == SupplyType.PUBLIC_RENTAL) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("housingCategory"), HousingCategory.PUBLIC_RENTAL));
        }
        if (StringUtils.hasText(keyword)) {
            String normalizedKeyword = keyword.trim().toLowerCase();
            if (normalizedKeyword.length() > 100) {
                normalizedKeyword = normalizedKeyword.substring(0, 100);
            }
            String pattern = "%" + normalizedKeyword + "%";
            specification = specification.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("title")), pattern),
                    cb.like(cb.lower(root.get("address")), pattern),
                    cb.like(cb.lower(root.get("housingDetailType")), pattern)
            ));
        }
        if (StringUtils.hasText(region)) {
            String requestedRegion = region.trim().toLowerCase();
            String normalizedRegion = requestedRegion.length() > 20
                    ? requestedRegion.substring(0, 20)
                    : requestedRegion;
            specification = specification.and((root, query, cb) -> cb.or(
                    cb.equal(cb.lower(root.get("regionCode")), normalizedRegion),
                    cb.like(cb.lower(root.get("address")), normalizedRegion + "%")
            ));
        }
        if (minPrice != null && minPrice.signum() >= 0) {
            specification = specification.and((root, query, cb) ->
                    // 공고의 주택형 가격대와 사용자의 예산 구간이 한 번이라도 겹치면 노출한다.
                    // 예: 3~5.5억 공고는 최소 예산 5억 검색 결과에 포함되어야 한다.
                    cb.greaterThanOrEqualTo(root.<BigDecimal>get("maxPrice"), minPrice));
        }
        if (maxPrice != null && maxPrice.signum() >= 0) {
            specification = specification.and((root, query, cb) ->
                    cb.lessThanOrEqualTo(root.<BigDecimal>get("minPrice"), maxPrice));
        }
        return specification;
    }

    public NoticeDetailResponse findById(Long id) {
        return noticeRepository.findById(id)
                .map(notice -> NoticeDetailResponse.from(notice, unitTypeRepository.findAllByNoticeIdOrderBySupplyAreaAscHousingTypeNameAsc(notice.getId()).stream()
                        .map(com.cheongyakone.api.NoticeUnitTypeResponse::from).toList()))
                .orElseThrow(() -> new NoticeNotFoundException(id));
    }

    public List<NoticeChangeResponse> findChanges(Long id) {
        if (!noticeRepository.existsById(id)) {
            throw new NoticeNotFoundException(id);
        }
        return changeHistoryRepository.findTop20ByNoticeIdOrderByChangedAtDesc(id).stream()
                .map(NoticeChangeResponse::from)
                .toList();
    }
}
