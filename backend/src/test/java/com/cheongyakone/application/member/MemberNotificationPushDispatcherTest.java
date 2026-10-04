package com.cheongyakone.application.member;

import com.cheongyakone.domain.member.MemberNotificationRepository;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import java.time.*;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MemberNotificationPushDispatcherTest {
    private final MemberNotificationRepository repository = mock(MemberNotificationRepository.class);
    private final MemberNotificationPushDelivery delivery = mock(MemberNotificationPushDelivery.class);
    private final Instant now = Instant.parse("2026-10-04T00:00:00Z");
    private final MemberNotificationPushDispatcher dispatcher = new MemberNotificationPushDispatcher(
            repository, delivery, Clock.fixed(now, ZoneOffset.UTC));

    @Test void oneTransactionFailureDoesNotBlockLaterNotificationsOrLeakDetails() {
        when(repository.findPushDeliveryCandidateIds(now, 5, PageRequest.of(0, 50))).thenReturn(List.of(1L, 2L, 3L));
        when(delivery.deliver(1L)).thenThrow(new IllegalStateException("private-token-and-sql"));
        when(delivery.deliver(2L)).thenReturn(false);
        when(delivery.deliver(3L)).thenReturn(true);
        Logger logger = (Logger) LoggerFactory.getLogger(MemberNotificationPushDispatcher.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start(); logger.addAppender(appender);
        try {
            assertThat(dispatcher.deliverPendingPushes()).isEqualTo(1);
            var order = inOrder(delivery);
            order.verify(delivery).deliver(1L);
            order.verify(delivery).deliver(2L);
            order.verify(delivery).deliver(3L);
            verifyNoMoreInteractions(delivery);
            assertThat(appender.list).hasSize(1);
            assertThat(appender.list.get(0).getFormattedMessage()).contains("notificationId=1", "IllegalStateException")
                    .doesNotContain("private-token-and-sql");
            assertThat(appender.list.get(0).getThrowableProxy()).isNull();
        } finally { logger.detachAppender(appender); appender.stop(); }
    }

    @Test void anEmptyQueueDoesNotCallDelivery() {
        assertThat(dispatcher.deliverPendingPushes()).isZero();
        verifyNoInteractions(delivery);
    }

    @Test void candidateQueryFailureStillFailsTheOperation() {
        when(repository.findPushDeliveryCandidateIds(now, 5, PageRequest.of(0, 50)))
                .thenThrow(new IllegalStateException("database unavailable"));
        assertThatThrownBy(dispatcher::deliverPendingPushes).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(delivery);
    }
}
