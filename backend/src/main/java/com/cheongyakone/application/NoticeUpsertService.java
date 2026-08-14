package com.cheongyakone.application;

import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class NoticeUpsertService {

    private final SubscriptionNoticeRepository noticeRepository;

    public NoticeUpsertService(SubscriptionNoticeRepository noticeRepository) {
        this.noticeRepository = noticeRepository;
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
                        snapshot.title()
                ));

        notice.updateFrom(snapshot, syncTime);
        noticeRepository.save(notice);
    }
}
