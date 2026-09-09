package com.cheongyakone.application;

import com.cheongyakone.domain.notice.NoticeChangeHistory;
import com.cheongyakone.domain.notice.NoticeChangeHistoryRepository;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class NoticeUpsertService {

    private final SubscriptionNoticeRepository noticeRepository;
    private final NoticeChangeHistoryRepository changeHistoryRepository;

    public NoticeUpsertService(SubscriptionNoticeRepository noticeRepository, NoticeChangeHistoryRepository changeHistoryRepository) {
        this.noticeRepository = noticeRepository;
        this.changeHistoryRepository = changeHistoryRepository;
    }

    @Transactional
    public void upsert(NoticeSnapshot snapshot, Instant syncTime) {
        SubscriptionNotice notice = noticeRepository
                .findBySourceSystemAndSourceNoticeId(snapshot.sourceSystem(), snapshot.sourceNoticeId())
                .orElseGet(() -> new SubscriptionNotice(
                        snapshot.sourceSystem(),
                        snapshot.sourceNoticeId(),
                        snapshot.housingCategory(),
                        snapshot.status(),
                        snapshot.title(),
                        syncTime
                ));

        notice.updateFrom(snapshot, syncTime);
        noticeRepository.save(notice);
        if (syncTime.equals(notice.getContentChangedAt()) && notice.getLastChangeSummary() != null
                && !changeHistoryRepository.existsByNoticeIdAndChangedAt(notice.getId(), syncTime)) {
            changeHistoryRepository.save(new NoticeChangeHistory(notice.getId(), notice.getLastChangeSummary(), syncTime));
        }
    }
}
