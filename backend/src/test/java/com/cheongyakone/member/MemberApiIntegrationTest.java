package com.cheongyakone.member;

import com.cheongyakone.application.member.MemberMailSender;
import com.cheongyakone.application.member.MemberNotificationEmailDispatcher;
import com.cheongyakone.application.member.MemberNotificationGenerator;
import com.cheongyakone.domain.member.MemberRepository;
import com.cheongyakone.domain.member.MemberRole;
import com.cheongyakone.domain.notice.HousingCategory;
import com.cheongyakone.domain.notice.NoticeSnapshot;
import com.cheongyakone.domain.notice.NoticeStatus;
import com.cheongyakone.domain.notice.SourceSystem;
import com.cheongyakone.domain.notice.SubscriptionNotice;
import com.cheongyakone.domain.notice.SubscriptionNoticeRepository;
import com.cheongyakone.domain.sync.SyncExecution;
import com.cheongyakone.domain.sync.SyncExecutionRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(MemberApiIntegrationTest.TestMailConfiguration.class)
class MemberApiIntegrationTest {

    private static final String PASSWORD = "Strong-password-1!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SubscriptionNoticeRepository noticeRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberNotificationGenerator notificationGenerator;

    @Autowired
    private MemberNotificationEmailDispatcher notificationEmailDispatcher;

    @Autowired
    private SyncExecutionRepository syncExecutionRepository;

    @Autowired
    private RecordingMemberMailSender mailSender;

    @Test
    void signsUpLogsInUpdatesProfileAndLogsOut() throws Exception {
        signup("member1@example.com", "첫회원");

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("member1@example.com", "중복회원")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_USED"));

        MvcResult login = login("MEMBER1@example.com", PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("member1@example.com"))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("SameSite=Lax")))
                .andReturn();
        AuthenticatedSession session = authenticatedSession(login);

        mockMvc.perform(get("/api/v1/members/me").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("첫회원"));

        mockMvc.perform(authenticated(patch("/api/v1/members/me"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"바뀐이름\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value("바뀐이름"));

        mockMvc.perform(authenticated(post("/api/v1/auth/logout"), session))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));
        mockMvc.perform(get("/api/v1/members/me").cookie(session.cookie()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requiresConsentForPersonalProfileAndAllowsDeletingItSeparately() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":"profile@example.com",
                                  "password":"Strong-password-1!",
                                  "nickname":"맞춤회원",
                                  "birthDate":"1992-05-17"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PERSONAL_PROFILE_CONSENT_REQUIRED"));

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":"profile@example.com",
                                  "password":"Strong-password-1!",
                                  "nickname":"맞춤회원",
                                  "birthDate":"1992-05-17",
                                  "gender":"FEMALE",
                                  "maritalStatus":"MARRIED",
                                  "householdMemberCount":3,
                                  "childCount":1,
                                  "residenceRegion":"서울",
                                  "personalProfileConsent":true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.birthDate").value("1992-05-17"))
                .andExpect(jsonPath("$.gender").value("FEMALE"))
                .andExpect(jsonPath("$.maritalStatus").value("MARRIED"))
                .andExpect(jsonPath("$.householdMemberCount").value(3))
                .andExpect(jsonPath("$.childCount").value(1))
                .andExpect(jsonPath("$.residenceRegion").value("서울"))
                .andExpect(jsonPath("$.personalProfileConsentedAt").isNotEmpty())
                .andExpect(jsonPath("$.personalProfileConsentVersion").value("2026-09-10-v2"));

        confirmEmail("profile@example.com");
        AuthenticatedSession session = authenticatedSession(
                login("profile@example.com", PASSWORD).andExpect(status().isOk()).andReturn()
        );
        mockMvc.perform(authenticated(delete("/api/v1/members/me/personal-profile"), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthDate").isEmpty())
                .andExpect(jsonPath("$.gender").isEmpty())
                .andExpect(jsonPath("$.residenceRegion").isEmpty())
                .andExpect(jsonPath("$.personalProfileConsentedAt").isEmpty())
                .andExpect(jsonPath("$.personalProfileConsentVersion").isEmpty())
                .andExpect(jsonPath("$.nickname").value("맞춤회원"));
    }

    @Test
    void rejectsInvalidPersonalProfileValues() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":"invalid-profile@example.com",
                                  "password":"Strong-password-1!",
                                  "nickname":"검증회원",
                                  "householdMemberCount":0,
                                  "residenceRegion":"목록에없는지역"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void locksAccountForTenMinutesAfterFiveFailures() throws Exception {
        signup("locked@example.com", "잠금회원");

        for (int attempt = 1; attempt < 5; attempt++) {
            login("locked@example.com", "wrong-password")
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }
        login("locked@example.com", "wrong-password")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("LOGIN_LOCKED"));
        login("locked@example.com", PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("LOGIN_LOCKED"));
    }

    @Test
    void verifiesEmailAndResetsPasswordWithOneTimeLinks() throws Exception {
        signupUnverified("recovery@example.com", "복구회원")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.emailVerified").value(false));

        login("recovery@example.com", PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_REQUIRED"));

        String verificationToken = mailSender.verificationToken("recovery@example.com");
        mockMvc.perform(post("/api/v1/auth/email-verification/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + verificationToken + "\"}"))
                .andExpect(status().isNoContent());
        AuthenticatedSession session = authenticatedSession(login("recovery@example.com", PASSWORD)
                .andExpect(jsonPath("$.emailVerified").value(true))
                .andReturn());

        mockMvc.perform(post("/api/v1/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"unknown@example.com\"}"))
                .andExpect(status().isAccepted());
        mockMvc.perform(post("/api/v1/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"recovery@example.com\"}"))
                .andExpect(status().isAccepted());

        String resetToken = mailSender.passwordResetToken("recovery@example.com");
        mockMvc.perform(post("/api/v1/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + resetToken
                                + "\",\"newPassword\":\"Recovered-password-2!\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/members/me").cookie(session.cookie()))
                .andExpect(status().isUnauthorized());
        login("recovery@example.com", PASSWORD).andExpect(status().isUnauthorized());
        login("recovery@example.com", "Recovered-password-2!").andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + resetToken
                                + "\",\"newPassword\":\"Another-password-3!\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_TOKEN"));
    }

    @Test
    void changesPasswordAndRevokesEverySession() throws Exception {
        signup("password@example.com", "비밀번호회원");
        AuthenticatedSession firstSession = authenticatedSession(login("password@example.com", PASSWORD).andReturn());
        AuthenticatedSession secondSession = authenticatedSession(login("password@example.com", PASSWORD).andReturn());
        mockMvc.perform(post("/api/v1/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"password@example.com\"}"))
                .andExpect(status().isAccepted());
        String pendingResetToken = mailSender.passwordResetToken("password@example.com");

        mockMvc.perform(authenticated(put("/api/v1/members/me/password"), firstSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"Strong-password-1!","newPassword":"New-password-2!"}
                                """))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/members/me").cookie(firstSession.cookie()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/members/me").cookie(secondSession.cookie()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + pendingResetToken
                                + "\",\"newPassword\":\"Unexpected-password-3!\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_TOKEN"));
        login("password@example.com", PASSWORD).andExpect(status().isUnauthorized());
        login("password@example.com", "New-password-2!").andExpect(status().isOk());
    }

    @Test
    void synchronizesAtMostThreeComparisonNoticesWithTheMemberAccount() throws Exception {
        List<SubscriptionNotice> notices = noticeRepository.saveAll(List.of(
                noticeWithDates("comparison-one", "비교 공고 1", LocalDate.now(), LocalDate.now().plusDays(3), null),
                noticeWithDates("comparison-two", "비교 공고 2", LocalDate.now(), LocalDate.now().plusDays(4), null),
                noticeWithDates("comparison-three", "비교 공고 3", LocalDate.now(), LocalDate.now().plusDays(5), null),
                noticeWithDates("comparison-four", "비교 공고 4", LocalDate.now(), LocalDate.now().plusDays(6), null)
        ));
        signup("comparison@example.com", "비교회원");
        AuthenticatedSession session = authenticatedSession(login("comparison@example.com", PASSWORD).andReturn());

        mockMvc.perform(authenticated(post("/api/v1/members/me/comparisons/merge"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"noticeIds\":[" + notices.get(1).getId() + "," + notices.get(0).getId() + "]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noticeIds[0]").value(notices.get(1).getId()))
                .andExpect(jsonPath("$.noticeIds[1]").value(notices.get(0).getId()));

        mockMvc.perform(authenticated(put("/api/v1/members/me/comparisons/{id}", notices.get(2).getId()), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noticeIds.length()").value(3));

        mockMvc.perform(authenticated(put("/api/v1/members/me/comparisons/{id}", notices.get(3).getId()), session))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMPARISON_LIMIT_REACHED"));

        mockMvc.perform(authenticated(delete("/api/v1/members/me/comparisons/{id}", notices.get(1).getId()), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noticeIds.length()").value(2));

        mockMvc.perform(authenticated(delete("/api/v1/members/me/comparisons"), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noticeIds.length()").value(0));

        mockMvc.perform(get("/api/v1/members/me/comparisons"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mergesFavoritesAndAnonymizesWithdrawnMember() throws Exception {
        SubscriptionNotice notice = noticeRepository.save(new SubscriptionNotice(
                SourceSystem.REB_APT,
                "member-favorite-notice",
                HousingCategory.APARTMENT,
                NoticeStatus.OPEN,
                "회원 관심 공고"
        ));
        signup("favorite@example.com", "관심회원");
        AuthenticatedSession session = authenticatedSession(login("favorite@example.com", PASSWORD).andReturn());

        mockMvc.perform(authenticated(post("/api/v1/members/me/favorites/merge"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"noticeIds\":[" + notice.getId() + ",999999]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noticeIds[0]").value(notice.getId()))
                .andExpect(jsonPath("$.noticeIds.length()").value(1));

        mockMvc.perform(authenticated(delete("/api/v1/members/me/favorites/{noticeId}", notice.getId()), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noticeIds.length()").value(0));
        mockMvc.perform(authenticated(put("/api/v1/members/me/favorites/{noticeId}", notice.getId()), session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noticeIds[0]").value(notice.getId()));

        mockMvc.perform(authenticated(delete("/api/v1/members/me"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"Strong-password-1!\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/members/me").cookie(session.cookie()))
                .andExpect(status().isUnauthorized());
        login("favorite@example.com", PASSWORD).andExpect(status().isUnauthorized());
        assertThat(memberRepository.findByEmail("favorite@example.com")).isEmpty();
    }

    @Test
    void rejectsInvalidInputsAndUnknownFavorite() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson("not-an-email", "한글")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        signup("favorite404@example.com", "확인회원");
        AuthenticatedSession session = authenticatedSession(login("favorite404@example.com", PASSWORD).andReturn());
        mockMvc.perform(authenticated(put("/api/v1/members/me/favorites/999999"), session))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTICE_NOT_FOUND"));
    }

    @Test
    void returnsExpandedNoticeDetailsWithoutAddingThemToListPayloads() throws Exception {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        SubscriptionNotice notice = new SubscriptionNotice(
                SourceSystem.REB_APT,
                "expanded-detail",
                HousingCategory.APARTMENT,
                NoticeStatus.UPCOMING,
                "상세정보 테스트 공고"
        );
        notice.updateFrom(new NoticeSnapshot(
                SourceSystem.REB_APT,
                "expanded-detail",
                HousingCategory.APARTMENT,
                NoticeStatus.UPCOMING,
                "상세정보 테스트 공고",
                "서울",
                "서울특별시 테스트구 상세로 1",
                today,
                today.plusDays(3),
                today.plusDays(5),
                today.plusDays(12),
                320,
                null,
                null,
                "https://example.test/official",
                "03333",
                "민영",
                "분양주택",
                "테스트 사업주체",
                "테스트 건설사",
                "02-1234-5678",
                "https://example.test/home",
                "202812",
                today.plusDays(2),
                today.plusDays(2),
                today.plusDays(20),
                today.plusDays(22),
                "expanded-detail-hash"
        ), Instant.now());
        notice = noticeRepository.save(notice);

        mockMvc.perform(get("/api/v1/notices/{id}", notice.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("상세정보 테스트 공고"))
                .andExpect(jsonPath("$.postalCode").value("03333"))
                .andExpect(jsonPath("$.housingDetailType").value("민영"))
                .andExpect(jsonPath("$.rentType").value("분양주택"))
                .andExpect(jsonPath("$.businessEntityName").value("테스트 사업주체"))
                .andExpect(jsonPath("$.constructionCompanyName").value("테스트 건설사"))
                .andExpect(jsonPath("$.contactPhone").value("02-1234-5678"))
                .andExpect(jsonPath("$.homepageUrl").value("https://example.test/home"))
                .andExpect(jsonPath("$.moveInPlannedMonth").value("202812"))
                .andExpect(jsonPath("$.specialSupplyStartDate").value(today.plusDays(2).toString()))
                .andExpect(jsonPath("$.contractEndDate").value(today.plusDays(22).toString()));

        mockMvc.perform(get("/api/v1/notices").param("keyword", "상세정보 테스트 공고"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].businessEntityName").doesNotExist());
    }

    @Test
    void protectsAndPersistsMemberSearchPreference() throws Exception {
        signup("preference@example.com", "맞춤회원");
        AuthenticatedSession session = authenticatedSession(login("preference@example.com", PASSWORD).andReturn());

        mockMvc.perform(get("/api/v1/members/me/search-preference").cookie(session.cookie()))
                .andExpect(status().isNoContent());

        mockMvc.perform(put("/api/v1/members/me/search-preference")
                        .cookie(session.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(searchPreferenceJson()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));

        mockMvc.perform(authenticated(put("/api/v1/members/me/search-preference"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(searchPreferenceJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.region").value("서울"))
                .andExpect(jsonPath("$.housingCategory").value("APARTMENT"))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.sort").value("DEADLINE"))
                .andExpect(jsonPath("$.minPriceManwon").value(30000))
                .andExpect(jsonPath("$.maxPriceManwon").value(60000));

        mockMvc.perform(get("/api/v1/members/me/search-preference").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.region").value("서울"));

        mockMvc.perform(authenticated(delete("/api/v1/members/me/search-preference"), session))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me/search-preference").cookie(session.cookie()))
                .andExpect(status().isNoContent());
    }

    @Test
    void protectsCreatesReadsUpdatesAndDeletesEligibilityProfile() throws Exception {
        mockMvc.perform(get("/api/v1/members/me/eligibility-profile"))
                .andExpect(status().isUnauthorized());

        signup("eligibility@example.com", "사전점검회원");
        AuthenticatedSession session = authenticatedSession(login("eligibility@example.com", PASSWORD).andReturn());

        mockMvc.perform(get("/api/v1/members/me/eligibility-profile").cookie(session.cookie()))
                .andExpect(status().isNoContent());

        String initialProfile = """
                {
                  "homeless": "YES",
                  "subscriptionAccount": "YES",
                  "newlywed": "UNKNOWN",
                  "firstHome": "NO"
                }
                """;
        mockMvc.perform(put("/api/v1/members/me/eligibility-profile")
                        .cookie(session.cookie())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(initialProfile))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));

        mockMvc.perform(authenticated(put("/api/v1/members/me/eligibility-profile"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(initialProfile))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.homeless").value("YES"))
                .andExpect(jsonPath("$.subscriptionAccount").value("YES"))
                .andExpect(jsonPath("$.newlywed").value("UNKNOWN"))
                .andExpect(jsonPath("$.firstHome").value("NO"))
                .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        mockMvc.perform(get("/api/v1/members/me/eligibility-profile").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstHome").value("NO"));

        mockMvc.perform(authenticated(put("/api/v1/members/me/eligibility-profile"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "homeless": "NO",
                                  "subscriptionAccount": "UNKNOWN",
                                  "newlywed": "YES",
                                  "firstHome": "YES"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.homeless").value("NO"))
                .andExpect(jsonPath("$.subscriptionAccount").value("UNKNOWN"))
                .andExpect(jsonPath("$.newlywed").value("YES"))
                .andExpect(jsonPath("$.firstHome").value("YES"));

        mockMvc.perform(authenticated(delete("/api/v1/members/me/eligibility-profile"), session))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me/eligibility-profile").cookie(session.cookie()))
                .andExpect(status().isNoContent());
    }

    @Test
    void listsAndRevokesLoginSessionsWithoutEndingCurrentSession() throws Exception {
        signup("sessions@example.com", "기기관리회원");
        AuthenticatedSession firstSession = authenticatedSession(login(
                "sessions@example.com",
                PASSWORD,
                "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36"
        ).andReturn());
        AuthenticatedSession secondSession = authenticatedSession(login(
                "sessions@example.com",
                PASSWORD,
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
        ).andReturn());

        MvcResult sessions = mockMvc.perform(get("/api/v1/members/me/sessions").cookie(firstSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].clientName").value("Safari · iPhone"))
                .andExpect(jsonPath("$[0].current").value(false))
                .andExpect(jsonPath("$[1].clientName").value("Chrome · Windows"))
                .andExpect(jsonPath("$[1].current").value(true))
                .andReturn();
        Number secondSessionId = JsonPath.read(sessions.getResponse().getContentAsString(), "$[0].id");
        Number currentSessionId = JsonPath.read(sessions.getResponse().getContentAsString(), "$[1].id");

        signup("other-sessions@example.com", "다른회원");
        AuthenticatedSession otherMemberSession = authenticatedSession(
                login("other-sessions@example.com", PASSWORD).andReturn()
        );
        mockMvc.perform(authenticated(
                        delete("/api/v1/members/me/sessions/{id}", secondSessionId),
                        otherMemberSession
                ))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));

        mockMvc.perform(authenticated(delete("/api/v1/members/me/sessions/{id}", currentSessionId), firstSession))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CURRENT_SESSION_CANNOT_BE_REVOKED"));
        mockMvc.perform(authenticated(delete("/api/v1/members/me/sessions/{id}", secondSessionId), firstSession))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me").cookie(secondSession.cookie()))
                .andExpect(status().isUnauthorized());

        AuthenticatedSession thirdSession = authenticatedSession(login("sessions@example.com", PASSWORD).andReturn());
        mockMvc.perform(authenticated(delete("/api/v1/members/me/sessions/others"), firstSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].current").value(true));
        mockMvc.perform(get("/api/v1/members/me").cookie(firstSession.cookie()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/members/me").cookie(thirdSession.cookie()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void generatesReadsAndConfiguresFavoriteNotifications() throws Exception {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        SubscriptionNotice startNotice = noticeRepository.save(noticeWithDates(
                "notification-start", "접수 시작 공고", today, null, null
        ));
        SubscriptionNotice deadlineNotice = noticeRepository.save(noticeWithDates(
                "notification-deadline", "마감 임박 공고", null, today.plusDays(3), null
        ));
        SubscriptionNotice winnerNotice = noticeRepository.save(noticeWithDates(
                "notification-winner", "당첨 발표 공고", null, null, today
        ));
        signup("notifications@example.com", "알림회원");
        AuthenticatedSession session = authenticatedSession(login("notifications@example.com", PASSWORD).andReturn());

        mockMvc.perform(authenticated(post("/api/v1/members/me/favorites/merge"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"noticeIds\":[" + startNotice.getId() + ","
                                + deadlineNotice.getId() + "," + winnerNotice.getId() + "]}"))
                .andExpect(status().isOk());

        assertThat(notificationGenerator.generateFor(today)).isEqualTo(3);
        assertThat(notificationGenerator.generateFor(today)).isZero();

        MvcResult inbox = mockMvc.perform(get("/api/v1/members/me/notifications").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.length()").value(3))
                .andExpect(jsonPath("$.unreadCount").value(3))
                .andReturn();
        Number notificationId = JsonPath.read(inbox.getResponse().getContentAsString(), "$.notifications[0].id");

        mockMvc.perform(authenticated(
                        patch("/api/v1/members/me/notifications/{id}/read", notificationId),
                        session
                ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt").isNotEmpty());
        mockMvc.perform(authenticated(post("/api/v1/members/me/notifications/read-all"), session))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me/notifications").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(0));

        mockMvc.perform(get("/api/v1/members/me/notifications/preference").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applyStartEnabled").value(true))
                .andExpect(jsonPath("$.deadline7dEnabled").value(true))
                .andExpect(jsonPath("$.newMatchingNoticeEnabled").value(true))
                .andExpect(jsonPath("$.noticeUpdatedEnabled").value(true))
                .andExpect(jsonPath("$.emailEnabled").value(false));
        mockMvc.perform(authenticated(put("/api/v1/members/me/notifications/preference"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "applyStartEnabled": false,
                                  "deadline7dEnabled": false,
                                  "deadline3dEnabled": false,
                                  "deadline1dEnabled": true,
                                  "winnerEnabled": false,
                                  "newMatchingNoticeEnabled": true,
                                  "noticeUpdatedEnabled": true,
                                  "emailEnabled": true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deadline1dEnabled").value(true))
                .andExpect(jsonPath("$.winnerEnabled").value(false))
                .andExpect(jsonPath("$.newMatchingNoticeEnabled").value(true))
                .andExpect(jsonPath("$.noticeUpdatedEnabled").value(true))
                .andExpect(jsonPath("$.emailEnabled").value(true));

        SubscriptionNotice oneDayNotice = noticeRepository.save(noticeWithDates(
                "notification-one-day", "내일 마감 공고", null, today.plusDays(1), null
        ));
        mockMvc.perform(authenticated(
                        put("/api/v1/members/me/favorites/{id}", oneDayNotice.getId()),
                        session
                ))
                .andExpect(status().isOk());
        int deliveredBefore = mailSender.noticeDeliveryCount();
        assertThat(notificationGenerator.generateFor(today)).isEqualTo(1);

        mockMvc.perform(authenticated(put("/api/v1/members/me/notifications/preference"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(notificationPreferenceJson(false)))
                .andExpect(status().isOk());
        assertThat(notificationEmailDispatcher.deliverPendingEmails()).isZero();
        assertThat(mailSender.noticeDeliveryCount()).isEqualTo(deliveredBefore);

        mockMvc.perform(authenticated(put("/api/v1/members/me/notifications/preference"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(notificationPreferenceJson(true)))
                .andExpect(status().isOk());
        SubscriptionNotice emailedNotice = noticeRepository.save(noticeWithDates(
                "notification-email", "이메일 발송 공고", null, today.plusDays(1), null
        ));
        mockMvc.perform(authenticated(
                        put("/api/v1/members/me/favorites/{id}", emailedNotice.getId()),
                        session
                ))
                .andExpect(status().isOk());
        assertThat(notificationGenerator.generateFor(today)).isEqualTo(1);
        assertThat(notificationEmailDispatcher.deliverPendingEmails()).isEqualTo(1);
        assertThat(mailSender.noticeDeliveryCount()).isEqualTo(deliveredBefore + 1);

        mockMvc.perform(authenticated(
                        delete("/api/v1/members/me/favorites/{id}", oneDayNotice.getId()),
                        session
                ))
                .andExpect(status().isOk());
        mockMvc.perform(authenticated(
                        delete("/api/v1/members/me/favorites/{id}", emailedNotice.getId()),
                        session
                ))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/members/me/notifications").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.length()").value(3));
    }

    private String notificationPreferenceJson(boolean emailEnabled) {
        return """
                {
                  "applyStartEnabled": false,
                  "deadline7dEnabled": false,
                  "deadline3dEnabled": false,
                  "deadline1dEnabled": true,
                  "winnerEnabled": false,
                  "newMatchingNoticeEnabled": true,
                  "noticeUpdatedEnabled": true,
                  "emailEnabled": %s
                }
                """.formatted(emailEnabled);
    }

    @Test
    void notifiesFavoriteMembersWhenVisibleNoticeInformationChanges() throws Exception {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        SubscriptionNotice notice = noticeRepository.save(noticeWithDates(
                "updated-favorite-notification",
                "변경 알림 공고",
                today.plusDays(1),
                today.plusDays(5),
                today.plusDays(10)
        ));
        signup("updated-notification@example.com", "변경알림회원");
        AuthenticatedSession session = authenticatedSession(
                login("updated-notification@example.com", PASSWORD).andReturn()
        );
        mockMvc.perform(authenticated(put("/api/v1/members/me/favorites/{id}", notice.getId()), session))
                .andExpect(status().isOk());

        Instant changeTime = today.plusDays(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant().minusSeconds(1);
        notice.updateFrom(new NoticeSnapshot(
                SourceSystem.REB_APT,
                "updated-favorite-notification",
                HousingCategory.APARTMENT,
                NoticeStatus.CLOSED,
                "변경 알림 공고",
                "서울",
                "서울시 테스트구",
                LocalDate.now(),
                today.plusDays(1),
                today.plusDays(5),
                today.plusDays(10),
                null,
                null,
                null,
                null,
                "status-only-change"
        ), changeTime.minusSeconds(60));
        assertThat(notice.getContentChangedAt()).isNull();

        notice.updateFrom(new NoticeSnapshot(
                SourceSystem.REB_APT,
                "updated-favorite-notification",
                HousingCategory.APARTMENT,
                NoticeStatus.CLOSED,
                "변경 알림 공고",
                "서울",
                "서울시 테스트구",
                LocalDate.now(),
                today.plusDays(1),
                today.plusDays(6),
                today.plusDays(10),
                null,
                null,
                null,
                null,
                "visible-date-change"
        ), changeTime);
        noticeRepository.saveAndFlush(notice);

        assertThat(notice.getContentChangedAt()).isEqualTo(changeTime);
        assertThat(notice.getLastChangeSummary()).isEqualTo("접수 일정");
        mockMvc.perform(get("/api/v1/notices/{id}", notice.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentChangedAt").isNotEmpty())
                .andExpect(jsonPath("$.lastChangeSummary").value("접수 일정"));
        assertThat(notificationGenerator.generateUpdatedFor(today)).isEqualTo(1);
        assertThat(notificationGenerator.generateUpdatedFor(today)).isZero();

        mockMvc.perform(get("/api/v1/members/me/notifications").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.length()").value(1))
                .andExpect(jsonPath("$.notifications[0].type").value("NOTICE_UPDATED"))
                .andExpect(jsonPath("$.notifications[0].message").value(
                        "관심 공고의 일정 또는 주요 정보가 변경됐습니다."
                ));
    }

    @Test
    void notifiesOnlyNewNoticesMatchingSavedSearchConditions() throws Exception {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        SubscriptionNotice matchingNotice = noticeWithProfile(
                "matching-notification-target",
                "저장조건 신규 오피스텔",
                HousingCategory.OFFICETEL,
                NoticeStatus.UPCOMING,
                "대전알림전용",
                today.plusDays(2),
                today.plusDays(10)
        );
        SubscriptionNotice otherNotice = noticeWithProfile(
                "matching-notification-other",
                "지역이 다른 신규 오피스텔",
                HousingCategory.OFFICETEL,
                NoticeStatus.UPCOMING,
                "광주알림전용",
                today.plusDays(2),
                today.plusDays(10)
        );
        noticeRepository.saveAll(List.of(matchingNotice, otherNotice));
        signup("matching-notification@example.com", "신규알림회원");
        AuthenticatedSession session = authenticatedSession(
                login("matching-notification@example.com", PASSWORD).andReturn()
        );

        mockMvc.perform(authenticated(put("/api/v1/members/me/search-preference"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "region": "대전알림전용",
                                  "housingCategory": "OFFICETEL",
                                  "status": "ALL",
                                  "sort": "DEADLINE"
                                }
                                """))
                .andExpect(status().isOk());

        notificationGenerator.generateMatchingFor(today);
        notificationGenerator.generateMatchingFor(today);

        mockMvc.perform(get("/api/v1/members/me/notifications").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.length()").value(1))
                .andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.notifications[0].noticeId").value(matchingNotice.getId()))
                .andExpect(jsonPath("$.notifications[0].type").value("NEW_MATCHING_NOTICE"))
                .andExpect(jsonPath("$.notifications[0].message").value(
                        "저장한 검색조건에 맞는 새 공고가 등록됐습니다."
                ));
    }

    @Test
    void recommendsOnlyNoticesMatchingSavedMemberConditions() throws Exception {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        SubscriptionNotice matchingNotice = noticeWithProfile(
                "recommendation-match",
                "맞춤 추천 오피스텔",
                HousingCategory.OFFICETEL,
                NoticeStatus.UPCOMING,
                "서울",
                today.plusDays(2),
                today.plusDays(10)
        );
        SubscriptionNotice otherNotice = noticeWithProfile(
                "recommendation-other",
                "조건이 다른 아파트",
                HousingCategory.APARTMENT,
                NoticeStatus.UPCOMING,
                "서울",
                today.plusDays(2),
                today.plusDays(10)
        );
        noticeRepository.saveAll(List.of(matchingNotice, otherNotice));
        signup("recommendation@example.com", "추천회원");
        AuthenticatedSession session = authenticatedSession(login("recommendation@example.com", PASSWORD).andReturn());

        mockMvc.perform(authenticated(put("/api/v1/members/me/search-preference"), session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "region": "서울",
                                  "housingCategory": "OFFICETEL",
                                  "status": "ALL",
                                  "sort": "DEADLINE"
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/members/me/recommendations").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.recommendations.length()").value(1))
                .andExpect(jsonPath("$.recommendations[0].notice.title").value("맞춤 추천 오피스텔"))
                .andExpect(jsonPath("$.recommendations[0].notice.housingCategory").value("OFFICETEL"))
                .andExpect(jsonPath("$.recommendations[0].score").isNumber())
                .andExpect(jsonPath("$.recommendations[0].reasons.length()").value(4));

        mockMvc.perform(authenticated(
                        post("/api/v1/members/me/recommendations/{id}/dismiss", matchingNotice.getId()),
                        session
                ))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me/recommendations").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dismissedCount").value(1))
                .andExpect(jsonPath("$.recommendations.length()").value(0));

        mockMvc.perform(authenticated(
                        put("/api/v1/members/me/favorites/{id}", matchingNotice.getId()),
                        session
                ))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/members/me/recommendations").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dismissedCount").value(0))
                .andExpect(jsonPath("$.recommendations.length()").value(1));

        mockMvc.perform(authenticated(
                        post("/api/v1/members/me/recommendations/{id}/dismiss", matchingNotice.getId()),
                        session
                ))
                .andExpect(status().isNoContent());

        mockMvc.perform(authenticated(
                        delete("/api/v1/members/me/recommendations/dismissed"),
                        session
                ))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me/recommendations").cookie(session.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dismissedCount").value(0))
                .andExpect(jsonPath("$.recommendations.length()").value(1));
    }

    @Test
    void allowsOnlyConfiguredAdminToInspectSanitizedSyncHistory() throws Exception {
        signup("admin-reader@example.com", "일반회원");
        AuthenticatedSession regularSession = authenticatedSession(
                login("admin-reader@example.com", PASSWORD).andReturn()
        );
        mockMvc.perform(get("/api/v1/admin/sync-executions").cookie(regularSession.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_REQUIRED"));
        mockMvc.perform(authenticated(post("/api/v1/admin/sync-executions"), regularSession))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_REQUIRED"));
        mockMvc.perform(get("/api/v1/admin/members").cookie(regularSession.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_REQUIRED"));
        mockMvc.perform(get("/api/v1/admin/members/statistics").cookie(regularSession.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_REQUIRED"));
        mockMvc.perform(get("/api/v1/admin/audit-logs").cookie(regularSession.cookie()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ADMIN_REQUIRED"));

        for (int attempt = 1; attempt < 5; attempt++) {
            login("admin-reader@example.com", "wrong-password").andExpect(status().isUnauthorized());
        }
        login("admin-reader@example.com", "wrong-password").andExpect(status().isTooManyRequests());

        signupUnverified("admin@example.com", "운영관리자")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("USER"));
        confirmEmail("admin@example.com");
        var admin = memberRepository.findByEmail("admin@example.com").orElseThrow();
        admin.changeRole(MemberRole.ADMIN, Instant.now());
        memberRepository.save(admin);
        AuthenticatedSession adminSession = authenticatedSession(login("admin@example.com", PASSWORD)
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andReturn());

        String statisticsBirthDate = LocalDate.now(ZoneId.of("Asia/Seoul")).minusYears(32).toString();
        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":"statistics-member@example.com",
                                  "password":"Strong-password-1!",
                                  "nickname":"통계회원",
                                  "birthDate":"%s",
                                  "gender":"FEMALE",
                                  "maritalStatus":"MARRIED",
                                  "householdMemberCount":3,
                                  "childCount":1,
                                  "residenceRegion":"서울",
                                  "personalProfileConsent":true
                                }
                                """.formatted(statisticsBirthDate)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/admin/members/statistics").cookie(adminSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeMemberCount").value(
                        org.hamcrest.Matchers.greaterThanOrEqualTo(3)
                ))
                .andExpect(jsonPath("$.consentedProfileCount").value(
                        org.hamcrest.Matchers.greaterThanOrEqualTo(1)
                ))
                .andExpect(jsonPath("$.genders[0].key").value("FEMALE"))
                .andExpect(jsonPath("$.genders[0].count").value(
                        org.hamcrest.Matchers.greaterThanOrEqualTo(1)
                ))
                .andExpect(jsonPath("$.ageGroups[2].key").value("THIRTIES"))
                .andExpect(jsonPath("$.ageGroups[2].count").value(
                        org.hamcrest.Matchers.greaterThanOrEqualTo(1)
                ))
                .andExpect(jsonPath("$.residenceRegions[*].label").value(
                        org.hamcrest.Matchers.hasItem("서울")
                ))
                .andExpect(jsonPath("$.generatedAt").isNotEmpty())
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.birthDate").doesNotExist());

        SyncExecution succeeded = SyncExecution.start(Instant.parse("2026-09-04T00:00:00Z"));
        succeeded.succeed(Instant.parse("2026-09-04T00:00:12Z"), 20, 18);
        syncExecutionRepository.save(succeeded);
        SyncExecution failed = SyncExecution.start(Instant.parse("2026-09-04T01:00:00Z"));
        failed.fail(
                Instant.parse("2026-09-04T01:00:03Z"),
                new IllegalStateException("API request failed: serviceKey=should-be-redacted&code=500")
        );
        syncExecutionRepository.save(failed);

        mockMvc.perform(get("/api/v1/admin/sync-executions").cookie(adminSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.executions.length()").value(2))
                .andExpect(jsonPath("$.executions[0].status").value("FAILED"))
                .andExpect(jsonPath("$.executions[0].errorMessage").value(
                        org.hamcrest.Matchers.containsString("serviceKey=***")
                ))
                .andExpect(jsonPath("$.executions[0].errorMessage").value(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("should-be-redacted"))
                ))
                .andExpect(jsonPath("$.executions[1].durationSeconds").value(12))
                .andExpect(jsonPath("$.executions[1].savedCount").value(18));

        MvcResult memberSearch = mockMvc.perform(get("/api/v1/admin/members")
                        .cookie(adminSession.cookie())
                        .param("query", "admin-reader")
                        .param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.members[0].email").value("admin-reader@example.com"))
                .andExpect(jsonPath("$.members[0].failedLoginAttempts").value(5))
                .andExpect(jsonPath("$.members[0].activeSessionCount").value(1))
                .andReturn();
        Number regularMemberId = JsonPath.read(
                memberSearch.getResponse().getContentAsString(),
                "$.members[0].id"
        );

        mockMvc.perform(authenticated(
                        post("/api/v1/admin/members/{id}/unlock", regularMemberId),
                        adminSession
                ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failedLoginAttempts").value(0))
                .andExpect(jsonPath("$.lockedUntil").isEmpty());
        mockMvc.perform(authenticated(
                        delete("/api/v1/admin/members/{id}/sessions", regularMemberId),
                        adminSession
                ))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me").cookie(regularSession.cookie()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/password-reset/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin-reader@example.com\"}"))
                .andExpect(status().isAccepted());
        String tokenIssuedBeforeSuspension = mailSender.passwordResetToken("admin-reader@example.com");

        mockMvc.perform(authenticated(
                        post("/api/v1/admin/members/{id}/suspend", regularMemberId),
                        adminSession
                ).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"운영정책 위반\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.suspendedAt").isNotEmpty());
        login("admin-reader@example.com", PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        mockMvc.perform(get("/api/v1/admin/members")
                        .cookie(adminSession.cookie())
                        .param("query", "admin-reader")
                        .param("status", "SUSPENDED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        mockMvc.perform(authenticated(
                        post("/api/v1/admin/members/{id}/reactivate", regularMemberId),
                        adminSession
                ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.suspendedAt").isEmpty());
        mockMvc.perform(post("/api/v1/auth/password-reset/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + tokenIssuedBeforeSuspension
                                + "\",\"newPassword\":\"Changed-password-2!\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OR_EXPIRED_TOKEN"));
        login("admin-reader@example.com", PASSWORD).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/audit-logs").cookie(adminSession.cookie()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].action").value("MEMBER_REACTIVATED"))
                .andExpect(jsonPath("$[0].affectedCount").value(1))
                .andExpect(jsonPath("$[0].actorEmail").value("admin@example.com"))
                .andExpect(jsonPath("$[0].targetEmail").value("admin-reader@example.com"))
                .andExpect(jsonPath("$[1].action").value("MEMBER_SUSPENDED"))
                .andExpect(jsonPath("$[1].details").value("운영정책 위반"))
                .andExpect(jsonPath("$[2].action").value("MEMBER_SESSIONS_REVOKED"))
                .andExpect(jsonPath("$[3].action").value("MEMBER_LOGIN_UNLOCKED"));

        mockMvc.perform(authenticated(
                        delete("/api/v1/admin/members/{id}/sessions", admin.getId()),
                        adminSession
                ))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CANNOT_REVOKE_OWN_ADMIN_SESSIONS"));
        mockMvc.perform(authenticated(
                        post("/api/v1/admin/members/{id}/suspend", admin.getId()),
                        adminSession
                ).contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"실수 방지 확인\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ADMIN_MEMBER_CANNOT_BE_SUSPENDED"));
    }

    private void signup(String email, String nickname) throws Exception {
        signupUnverified(email, nickname).andExpect(status().isCreated());
        confirmEmail(email);
    }

    private org.springframework.test.web.servlet.ResultActions signupUnverified(
            String email,
            String nickname
    ) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(signupJson(email, nickname)));
    }

    private void confirmEmail(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/email-verification/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + mailSender.verificationToken(email) + "\"}"))
                .andExpect(status().isNoContent());
    }

    private org.springframework.test.web.servlet.ResultActions login(String email, String password) throws Exception {
        return login(email, password, null);
    }

    private org.springframework.test.web.servlet.ResultActions login(
            String email,
            String password,
            String userAgent
    ) throws Exception {
        MockHttpServletRequestBuilder request = post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
        if (userAgent != null) {
            request.header(HttpHeaders.USER_AGENT, userAgent);
        }
        return mockMvc.perform(request);
    }

    private String signupJson(String email, String nickname) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD
                + "\",\"nickname\":\"" + nickname + "\"}";
    }

    private String searchPreferenceJson() {
        return """
                {"region":"서울","housingCategory":"APARTMENT","status":"OPEN","sort":"DEADLINE","minPriceManwon":30000,"maxPriceManwon":60000}
                """;
    }

    private SubscriptionNotice noticeWithDates(
            String sourceNoticeId,
            String title,
            LocalDate applyStartDate,
            LocalDate applyEndDate,
            LocalDate winnerAnnounceDate
    ) {
        SubscriptionNotice notice = new SubscriptionNotice(
                SourceSystem.REB_APT,
                sourceNoticeId,
                HousingCategory.APARTMENT,
                NoticeStatus.OPEN,
                title
        );
        notice.updateFrom(new NoticeSnapshot(
                SourceSystem.REB_APT,
                sourceNoticeId,
                HousingCategory.APARTMENT,
                NoticeStatus.OPEN,
                title,
                "서울",
                "서울시 테스트구",
                LocalDate.now(),
                applyStartDate,
                applyEndDate,
                winnerAnnounceDate,
                null,
                null,
                null,
                null,
                "notification-test-hash-" + sourceNoticeId
        ), Instant.now());
        return notice;
    }

    private SubscriptionNotice noticeWithProfile(
            String sourceNoticeId,
            String title,
            HousingCategory housingCategory,
            NoticeStatus status,
            String region,
            LocalDate applyStartDate,
            LocalDate applyEndDate
    ) {
        SourceSystem sourceSystem = housingCategory == HousingCategory.OFFICETEL
                ? SourceSystem.REB_OFFICETEL
                : SourceSystem.REB_APT;
        SubscriptionNotice notice = new SubscriptionNotice(
                sourceSystem,
                sourceNoticeId,
                housingCategory,
                status,
                title
        );
        notice.updateFrom(new NoticeSnapshot(
                sourceSystem,
                sourceNoticeId,
                housingCategory,
                status,
                title,
                region,
                region + "시 테스트구",
                LocalDate.now(),
                applyStartDate,
                applyEndDate,
                null,
                null,
                null,
                null,
                null,
                "recommendation-test-hash-" + sourceNoticeId
        ), Instant.now());
        return notice;
    }

    private AuthenticatedSession authenticatedSession(MvcResult result) {
        List<String> setCookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        String sessionToken = cookieValue(setCookies, "CHEONGYAK_SESSION");
        String csrfToken = cookieValue(setCookies, "CHEONGYAK_CSRF");
        assertThat(result.getResponse().getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
        // MockMvc는 브라우저 쿠키 저장소가 없으므로 발급된 HttpOnly 쿠키를 다음 요청에 직접 전달한다.
        return new AuthenticatedSession(new Cookie("CHEONGYAK_SESSION", sessionToken), csrfToken);
    }

    private String cookieValue(List<String> setCookies, String name) {
        return setCookies.stream()
                .map(value -> value.split(";", 2)[0])
                .filter(value -> value.startsWith(name + "="))
                .map(value -> value.substring(name.length() + 1))
                .findFirst()
                .orElseThrow(() -> new AssertionError(name + " cookie was not issued"));
    }

    private MockHttpServletRequestBuilder authenticated(
            MockHttpServletRequestBuilder request,
            AuthenticatedSession session
    ) {
        return request.cookie(session.cookie())
                .header("X-CSRF-Token", session.csrfToken());
    }

    private record AuthenticatedSession(Cookie cookie, String csrfToken) {
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestMailConfiguration {

        @Bean
        @Primary
        RecordingMemberMailSender recordingMemberMailSender() {
            return new RecordingMemberMailSender();
        }
    }

    static class RecordingMemberMailSender implements MemberMailSender {

        private final Map<String, String> verificationTokens = new ConcurrentHashMap<>();
        private final Map<String, String> passwordResetTokens = new ConcurrentHashMap<>();
        private final List<String> noticeDeliveries = new CopyOnWriteArrayList<>();

        @Override
        public void sendEmailVerification(String email, String verificationUrl) {
            verificationTokens.put(email, tokenFrom(verificationUrl));
        }

        @Override
        public void sendPasswordReset(String email, String resetUrl) {
            passwordResetTokens.put(email, tokenFrom(resetUrl));
        }

        @Override
        public void sendNoticeNotification(
                String email,
                String noticeTitle,
                String notificationLabel,
                String message,
                String eventDate,
                String officialUrl
        ) {
            noticeDeliveries.add(email + ":" + noticeTitle + ":" + eventDate);
        }

        int noticeDeliveryCount() {
            return noticeDeliveries.size();
        }

        String verificationToken(String email) {
            return required(verificationTokens, email);
        }

        String passwordResetToken(String email) {
            return required(passwordResetTokens, email);
        }

        private String required(Map<String, String> tokens, String email) {
            String token = tokens.get(email);
            if (token == null) throw new AssertionError("No member email was recorded for " + email);
            return token;
        }

        private String tokenFrom(String url) {
            return url.substring(url.lastIndexOf('=') + 1);
        }
    }
}
