package com.cheongyakone.api;

import com.cheongyakone.application.NoticeQueryService;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeStatus;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notices")
public class NoticeController {

    private final NoticeQueryService noticeQueryService;

    public NoticeController(NoticeQueryService noticeQueryService) {
        this.noticeQueryService = noticeQueryService;
    }

    @GetMapping
    public Page<NoticeSummaryResponse> findNotices(
            @RequestParam(required = false) HousingCategory category,
            @RequestParam(required = false) NoticeStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return noticeQueryService.findNotices(category, status, keyword, page, size);
    }

    @GetMapping("/{id}")
    public NoticeSummaryResponse findNotice(@PathVariable Long id) {
        return noticeQueryService.findById(id);
    }
}
