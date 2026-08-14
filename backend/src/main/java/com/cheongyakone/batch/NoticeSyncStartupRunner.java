package com.cheongyakone.batch;

import com.cheongyakone.application.NoticeSyncResult;
import com.cheongyakone.application.NoticeSyncService;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Component
@ConditionalOnProperty(name = "app.notice-sync.run-on-startup", havingValue = "true")
public class NoticeSyncStartupRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(NoticeSyncStartupRunner.class);

    private final NoticeSyncService noticeSyncService;
    private final SubscriptionNoticeRepository noticeRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final Path exportPath;

    public NoticeSyncStartupRunner(
            NoticeSyncService noticeSyncService,
            SubscriptionNoticeRepository noticeRepository,
            ObjectMapper objectMapper,
            Clock clock,
            @Value("${app.notice-sync.export-path:target/reb-sample.json}") String exportPath
    ) {
        this.noticeSyncService = noticeSyncService;
        this.noticeRepository = noticeRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.exportPath = Path.of(exportPath).toAbsolutePath().normalize();
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        NoticeSyncResult result = noticeSyncService.synchronize();
        List<SubscriptionNotice> notices = noticeRepository.findAll(
                Sort.by(
                        Sort.Order.desc("noticeDate"),
                        Sort.Order.asc("housingCategory"),
                        Sort.Order.asc("title")
                )
        );

        List<NoticeExportItem> items = notices.stream()
                .limit(200)
                .map(NoticeExportItem::from)
                .toList();

        NoticeExportReport report = new NoticeExportReport(
                Instant.now(clock),
                result.fetchedCount(),
                result.savedCount(),
                notices.size(),
                items
        );

        Path parent = exportPath.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(exportPath.toFile(), report);

        log.info(
                "Real notice synchronization exported: path={}, fetched={}, saved={}, database={}",
                exportPath,
                result.fetchedCount(),
                result.savedCount(),
                notices.size()
        );
    }

    record NoticeExportReport(
            Instant generatedAt,
            int fetchedCount,
            int savedCount,
            int totalInDatabase,
            List<NoticeExportItem> notices
    ) {
    }

    record NoticeExportItem(
            Long id,
            HousingCategory category,
            NoticeStatus status,
            String title,
            String regionCode,
            String address,
            LocalDate noticeDate,
            LocalDate applyStartDate,
            LocalDate applyEndDate,
            LocalDate winnerAnnounceDate,
            Integer totalUnits,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            String officialUrl
    ) {
        static NoticeExportItem from(SubscriptionNotice notice) {
            return new NoticeExportItem(
                    notice.getId(),
                    notice.getHousingCategory(),
                    notice.getStatus(),
                    notice.getTitle(),
                    notice.getRegionCode(),
                    notice.getAddress(),
                    notice.getNoticeDate(),
                    notice.getApplyStartDate(),
                    notice.getApplyEndDate(),
                    notice.getWinnerAnnounceDate(),
                    notice.getTotalUnits(),
                    notice.getMinPrice(),
                    notice.getMaxPrice(),
                    notice.getOfficialUrl()
            );
        }
    }
}
