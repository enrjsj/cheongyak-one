package com.cheongyakone.application.member;

import com.cheongyakone.config.KakaoSelfProperties;
import com.cheongyakone.domain.member.Member;
import com.cheongyakone.infrastructure.kakao.KakaoSelfClient;
import com.cheongyakone.infrastructure.kakao.KakaoSelfTokenCipher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.web.util.UriComponentsBuilder;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class KakaoSelfServiceTest {
    static final Instant NOW=Instant.parse("2026-10-21T03:00:00Z");
    final Clock clock=Clock.fixed(NOW,ZoneOffset.UTC);
    final KakaoSelfProperties properties=new KakaoSelfProperties(true,1L,"test-key","",
            "https://example.com/api/v1/members/me/kakao-self/callback","https://example.com",Base64.getEncoder().encodeToString(new byte[32]));
    final MemberService members=mock(MemberService.class);
    final KakaoSelfClient client=mock(KakaoSelfClient.class);
    final KakaoSelfTokenCipher cipher=new KakaoSelfTokenCipher(properties);
    JdbcTemplate jdbc; KakaoSelfStore store; KakaoSelfService service;
    com.zaxxer.hikari.HikariDataSource ds;
    @AfterEach void close() { if(ds!=null) ds.close(); }
    @BeforeEach void setup() {
        ds=new com.zaxxer.hikari.HikariDataSource();
        ds.setJdbcUrl("jdbc:h2:mem:kakao-"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1"); ds.setUsername("sa"); ds.setPassword("");
        jdbc=new JdbcTemplate(ds);
        jdbc.execute("CREATE TABLE APP_MEMBER(ID BIGINT PRIMARY KEY, MEMBER_STATUS VARCHAR(20))");
        jdbc.execute("CREATE TABLE SUBSCRIPTION_NOTICE(ID BIGINT PRIMARY KEY, TITLE VARCHAR(300), HOUSING_CATEGORY VARCHAR(30), RENT_TYPE VARCHAR(100), MIN_PRICE NUMERIC(18,0), MAX_PRICE NUMERIC(18,0))");
        jdbc.execute("CREATE TABLE SUBSCRIPTION_NOTICE_UNIT_TYPE(NOTICE_ID BIGINT, SUPPLY_AREA NUMERIC(10,2))");
        jdbc.execute("CREATE TABLE MEMBER_FAVORITE(MEMBER_ID BIGINT, NOTICE_ID BIGINT)");
        jdbc.execute("CREATE TABLE MEMBER_NOTIFICATION_PREFERENCE(MEMBER_ID BIGINT PRIMARY KEY, APPLY_START_ENABLED BOOLEAN, DEADLINE_7D_ENABLED BOOLEAN, DEADLINE_3D_ENABLED BOOLEAN, DEADLINE_1D_ENABLED BOOLEAN)");
        jdbc.execute("CREATE TABLE MEMBER_NOTIFICATION(ID BIGINT PRIMARY KEY, MEMBER_ID BIGINT, NOTICE_ID BIGINT, NOTIFICATION_TYPE VARCHAR(30), CREATED_AT TIMESTAMP WITH TIME ZONE, EVENT_DATE DATE)");
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V39__kakao_self_notifications.sql")).execute(ds);
        jdbc.update("INSERT INTO APP_MEMBER VALUES(1,'ACTIVE'),(2,'ACTIVE')");
        jdbc.update("INSERT INTO SUBSCRIPTION_NOTICE(ID,TITLE,HOUSING_CATEGORY) VALUES(10,'청약 테스트','APARTMENT')");
        jdbc.update("INSERT INTO MEMBER_FAVORITE VALUES(1,10),(2,10)");
        var owner=mock(Member.class); when(owner.getId()).thenReturn(1L);
        var other=mock(Member.class); when(other.getId()).thenReturn(2L);
        when(members.requireMember("owner-session")).thenReturn(owner);
        when(members.requireMember("other-owner-session")).thenReturn(owner);
        when(members.requireMember("other-session")).thenReturn(other);
        when(members.requireMember(null)).thenThrow(new MemberApiException(org.springframework.http.HttpStatus.UNAUTHORIZED,"AUTH_REQUIRED","로그인 필요"));
        store=new KakaoSelfStore(jdbc,new DataSourceTransactionManager(ds));
        service=new KakaoSelfService(properties,members,store,client,cipher,clock);
        when(client.exchange(anyString())).thenReturn(new KakaoSelfClient.Tokens("access",3600,"refresh",100000));
    }
    String state() { return UriComponentsBuilder.fromUriString(service.authorize("owner-session")).build().getQueryParams().getFirst("state"); }
    void connect() { assertThat(service.callback("owner-session",state(),"code",null)).isEqualTo("connected"); }
    void notice(long id,long owner,String type,Instant time) { jdbc.update("INSERT INTO MEMBER_NOTIFICATION VALUES(?,?,10,?,?,?)",id,owner,type,Timestamp.from(time),LocalDate.of(2026,10,24)); }
    @Test void authorizationIsOwnerOnlyAndStatusDoesNotLeakConnection() {
        connect();
        assertThat(service.status("other-session").eligible()).isFalse();
        assertThat(service.status("other-session").lastSentAt()).isNull();
        assertThatThrownBy(() -> service.authorize("other-session")).isInstanceOf(MemberApiException.class);
        assertThatThrownBy(() -> service.test(null)).isInstanceOf(MemberApiException.class);
    }
    @Test void callbackRequiresSameSessionAndStateIsSingleUse() {
        String state=state();
        assertThat(service.callback("other-owner-session",state,"code",null)).isEqualTo("error");
        assertThat(service.callback("owner-session","wrong-state","code",null)).isEqualTo("error");
        assertThat(service.callback("owner-session",state,"code",null)).isEqualTo("connected");
        assertThat(service.callback("owner-session",state,"code",null)).isEqualTo("error");
        verify(client,times(1)).exchange("code");
        assertThat(store.read().accessToken()).doesNotContain("access");
    }
    @Test void deniedOrExpiredStateNeverCallsProviderAndDoesNotDestroyExistingConnection() {
        connect(); String state=state();
        assertThat(service.callback("owner-session",state,null,"access_denied")).isEqualTo("cancelled");
        assertThat(service.callback("owner-session",state,"code",null)).isEqualTo("error");
        state=state(); jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET STATE_EXPIRES_AT=?",Timestamp.from(NOW.minusSeconds(1)));
        assertThat(service.callback("owner-session",state,"code",null)).isEqualTo("error");
        assertThat(service.status("owner-session").connected()).isTrue(); verify(client,times(1)).exchange("code");
    }
    @Test void testSendUsesSelfOnlyAndPersistedCooldownSurvivesServiceRecreation() {
        connect();
        assertThat(service.test("owner-session").lastDeliveryStatus()).isEqualTo("SENT");
        var restarted=new KakaoSelfService(properties,members,store,client,cipher,clock);
        assertThatThrownBy(() -> restarted.test("owner-session")).isInstanceOf(MemberApiException.class);
        verify(client,times(1)).send(eq("access"),contains("연결 확인"),eq("https://example.com"));
    }
    @Test void newOwnerNotificationsOnlyOnceAndNoHistoricOrStaleOrUnselectedEvents() {
        notice(1,1,"APPLY_START",NOW.minusSeconds(1)); connect();
        notice(2,1,"APPLY_START",NOW); notice(3,2,"APPLY_START",NOW);
        notice(4,1,"WINNER_ANNOUNCEMENT",NOW); notice(5,1,"APPLY_DEADLINE_1D",NOW.minusSeconds(86400));
        service.scheduled(); service.scheduled();
        verify(client,times(1)).send(eq("access"),contains("청약 테스트"),eq("https://example.com/?notice=10"));
        assertThat(jdbc.queryForList("SELECT NOTIFICATION_ID FROM KAKAO_SELF_RECEIPT",Long.class)).containsExactly(2L);
    }
    @Test void sendClaimIsCommittedAndAmbiguousOutcomeNeverRetries() {
        connect(); notice(1,1,"APPLY_START",NOW);
        doAnswer(invocation -> {
            assertThat(jdbc.queryForObject("SELECT OUTCOME FROM KAKAO_SELF_RECEIPT WHERE NOTIFICATION_ID=1",String.class)).isEqualTo("UNKNOWN");
            throw new KakaoSelfClient.Failure("UNKNOWN");
        }).when(client).send(anyString(),anyString(),anyString());
        service.scheduled(); service.scheduled();
        verify(client,times(1)).send(anyString(),anyString(),anyString());
        assertThat(service.status("owner-session").lastDeliveryStatus()).isEqualTo("UNKNOWN");
    }
    @Test void eachNoticeGetsItsOwnPriceAndAreaSummaryWithoutDuplicatingUnitRows() {
        connect();
        jdbc.update("UPDATE SUBSCRIPTION_NOTICE SET MIN_PRICE=430000000,MAX_PRICE=580000000 WHERE ID=10");
        jdbc.update("INSERT INTO SUBSCRIPTION_NOTICE VALUES(11,'임대 테스트','PUBLIC_RENTAL',NULL,50000000,70000000)");
        jdbc.update("INSERT INTO MEMBER_FAVORITE VALUES(1,11)");
        jdbc.update("INSERT INTO SUBSCRIPTION_NOTICE_UNIT_TYPE VALUES(10,84.98),(10,112.50),(10,0),(10,-1),(10,NULL)");
        notice(1,1,"APPLY_START",NOW);
        jdbc.update("INSERT INTO MEMBER_NOTIFICATION VALUES(2,1,11,'APPLY_START',?,?)",Timestamp.from(NOW),LocalDate.of(2026,10,24));
        service.scheduled(); service.scheduled();
        verify(client).send(eq("access"),argThat(text -> text.contains("청약 테스트")
                && text.contains("분양가: 약 4.3억원 ~ 약 5.8억원")
                && text.contains("공급면적: 84.98 ~ 112.5㎡ (약 25.7 ~ 34.0평)")),eq("https://example.com/?notice=10"));
        verify(client).send(eq("access"),argThat(text -> text.contains("임대 테스트")
                && text.contains("임대보증금: 5000만원 ~ 7000만원")
                && text.contains("공급면적: 공고문 확인")),eq("https://example.com/?notice=11"));
        verify(client,times(2)).send(anyString(),anyString(),anyString());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM KAKAO_SELF_RECEIPT",Integer.class)).isEqualTo(2);
    }
    @Test void separateSelectedEventsForSameNoticeRemainSeparateMessages() {
        connect(); notice(1,1,"APPLY_START",NOW); notice(2,1,"APPLY_DEADLINE_3D",NOW);
        jdbc.update("INSERT INTO MEMBER_NOTIFICATION_PREFERENCE VALUES(1,TRUE,FALSE,TRUE,FALSE)");
        notice(3,1,"APPLY_DEADLINE_7D",NOW);
        service.scheduled(); service.scheduled();
        verify(client).send(eq("access"),contains("오늘 청약 접수가 시작됩니다."),eq("https://example.com/?notice=10"));
        verify(client).send(eq("access"),contains("청약 접수 마감까지 3일 남았습니다."),eq("https://example.com/?notice=10"));
        verify(client,times(2)).send(anyString(),anyString(),anyString());
    }
    @Test void refreshPreservesOmittedRefreshTokenAndUpdatesCiphertext() {
        connect(); jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET ACCESS_EXPIRES_AT=?",Timestamp.from(NOW));
        when(client.refresh("refresh")).thenReturn(new KakaoSelfClient.Tokens("new-access",3600,"",0));
        service.test("owner-session");
        assertThat(cipher.decrypt(store.read().refreshToken())).isEqualTo("refresh");
        assertThat(cipher.decrypt(store.read().accessToken())).isEqualTo("new-access");
        verify(client).send(eq("new-access"),anyString(),anyString());
    }
    @Test void revokedTokenRequiresReconnectAndCannotSend() {
        connect(); jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET ACCESS_EXPIRES_AT=?",Timestamp.from(NOW));
        when(client.refresh("refresh")).thenThrow(new KakaoSelfClient.Failure("RECONNECT_REQUIRED"));
        assertThatThrownBy(() -> service.test("owner-session")).isInstanceOf(MemberApiException.class);
        assertThat(service.status("owner-session").reconnectRequired()).isTrue();
        assertThat(store.read().refreshToken()).isNull(); verify(client,never()).send(anyString(),anyString(),anyString());
    }
    @Test void disconnectErasesCredentialsCancelsStateAndPreventLateRefreshResurrection() {
        connect(); String state=state(); var old=store.read(); String lease=store.acquire(1L,NOW,false);
        service.disconnect("owner-session");
        assertThat(store.refresh(old,lease,"stale","stale",NOW.plusSeconds(1),NOW.plusSeconds(1))).isFalse();
        assertThat(service.callback("owner-session",state,"code",null)).isEqualTo("error");
        assertThat(store.read().refreshToken()).isNull(); assertThat(service.status("owner-session").connected()).isFalse();
    }
    @Test void latestPreferenceFavoriteAndAccountStatusAreCheckedBeforeSending() {
        connect(); notice(1,1,"APPLY_START",NOW);
        jdbc.update("INSERT INTO MEMBER_NOTIFICATION_PREFERENCE VALUES(1,FALSE,TRUE,TRUE,TRUE)");
        service.scheduled();
        jdbc.update("UPDATE MEMBER_NOTIFICATION_PREFERENCE SET APPLY_START_ENABLED=TRUE");
        jdbc.update("DELETE FROM MEMBER_FAVORITE WHERE MEMBER_ID=1"); service.scheduled();
        jdbc.update("INSERT INTO MEMBER_FAVORITE VALUES(1,10)"); jdbc.update("UPDATE APP_MEMBER SET MEMBER_STATUS='WITHDRAWN' WHERE ID=1"); service.scheduled();
        verify(client,never()).send(anyString(),anyString(),anyString());
    }
    @Test void disabledScheduleNeverClaimsOrCallsProvider() {
        connect(); notice(1,1,"APPLY_START",NOW);
        var disabled=new KakaoSelfProperties(false,1L,"","","","","");
        new KakaoSelfService(disabled,members,store,client,cipher,clock).scheduled();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM KAKAO_SELF_RECEIPT",Integer.class)).isZero();
        verify(client,never()).send(anyString(),anyString(),anyString());
    }
    @Test void leasePreventsTwoInstancesSendingSimultaneously() throws Exception {
        connect();
        try(var executor=Executors.newFixedThreadPool(2)) {
            var gate=new CountDownLatch(1);
            Callable<String> claim=()->{gate.await(); return store.acquire(1L,NOW,false);};
            var first=executor.submit(claim); var second=executor.submit(claim); gate.countDown();
            assertThat(Arrays.asList(first.get(5,TimeUnit.SECONDS),second.get(5,TimeUnit.SECONDS))).filteredOn(Objects::nonNull).hasSize(1);
        }
    }
    @Test void newAuthorizationInvalidatesAlreadyConsumedOlderCallbackWithoutLosingConnectedTokens() {
        connect(); String first=state();
        String generation=store.consumeState(1L,MemberPushReceiptStore.hash(first),MemberPushReceiptStore.hash("owner-session"),NOW);
        String second=state();
        assertThat(store.connect(1L,generation,"old-access","old-refresh",NOW.plusSeconds(1),NOW.plusSeconds(2),NOW)).isFalse();
        assertThat(service.status("owner-session").connected()).isTrue();
        assertThat(service.callback("owner-session",second,"code",null)).isEqualTo("connected");
    }
    @Test void configuredOwnerChangeNeverReusesPreviousOwnersCredentials() {
        connect(); var changed=new KakaoSelfProperties(true,2L,"test-key","",properties.redirectUri(),properties.frontendBaseUrl(),properties.tokenEncryptionKey());
        var nextService=new KakaoSelfService(changed,members,store,client,cipher,clock);
        assertThat(nextService.status("other-session").connected()).isFalse();
        nextService.scheduled(); verify(client,never()).send(anyString(),anyString(),anyString());
    }
    @Test void withdrawalCleanupUsesStoredOwnerAndWorksInsideExistingTransaction() {
        connect();
        var transaction=new org.springframework.transaction.support.TransactionTemplate(new DataSourceTransactionManager(ds));
        transaction.execute(status -> {store.disconnectOwner(2L); return null;});
        assertThat(store.read().refreshToken()).isNotNull();
        transaction.execute(status -> {store.disconnectOwner(1L); return null;});
        assertThat(store.read().refreshToken()).isNull();
        assertThat(store.read().stateHash()).isNull();
    }
    @Test void testNeverReportsPreviousSuccessWhenConnectionChangesBeforeTheNewClaim() {
        connect(); service.test("owner-session");
        jdbc.update("UPDATE KAKAO_SELF_CONNECTION SET LAST_TEST_AT=NULL");
        var racingStore=spy(store);
        var racingService=new KakaoSelfService(properties,members,racingStore,client,cipher,clock);
        var generationChanged=new java.util.concurrent.atomic.AtomicBoolean();
        doAnswer(invocation -> {
            var snapshot=(KakaoSelfStore.Connection)invocation.callRealMethod();
            // status() reads before acquire; mutate only after the delivery snapshot was taken.
            if(snapshot.leaseId()!=null && generationChanged.compareAndSet(false,true)) service.authorize("owner-session");
            return snapshot;
        }).when(racingStore).read();
        assertThatThrownBy(() -> racingService.test("owner-session")).isInstanceOf(MemberApiException.class)
                .hasMessageContaining("이번 시험 메시지 발송을 확인하지 못했어요");
        verify(client,times(1)).send(anyString(),anyString(),anyString());
    }
}
