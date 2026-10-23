package com.cheongyakone.api.member;

import com.cheongyakone.api.ApiExceptionHandler;
import com.cheongyakone.application.member.KakaoSelfService;
import com.cheongyakone.application.member.MemberApiException;
import com.cheongyakone.application.member.SessionTokenCodec;
import com.cheongyakone.config.AuthProperties;
import com.cheongyakone.config.KakaoSelfProperties;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.Base64;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class KakaoSelfControllerTest {
    final KakaoSelfService service=mock(KakaoSelfService.class);
    final SessionTokenCodec codec=new SessionTokenCodec();
    MockMvc mvc;
    @BeforeEach void setup() {
        var cookies=new SessionCookieSupport(new AuthProperties(null,null,null,false,null));
        var props=new KakaoSelfProperties(true,1L,"test-key","","https://example.com/api/v1/members/me/kakao-self/callback","https://example.com",Base64.getEncoder().encodeToString(new byte[32]));
        mvc=MockMvcBuilders.standaloneSetup(new KakaoSelfController(service,cookies,props))
                .setControllerAdvice(new ApiExceptionHandler()).addInterceptors(new CsrfProtectionInterceptor(cookies,codec)).build();
    }
    @Test void everyMutationRejectsMissingCsrfBeforeServiceCall() throws Exception {
        var cookie=new Cookie("CHEONGYAK_SESSION","session");
        for (String path:new String[]{"/authorize","/test"}) mvc.perform(post("/api/v1/members/me/kakao-self"+path).cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/members/me/kakao-self").cookie(cookie)).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void authorizationUsesExistingSessionAndCsrfAndNeverCaches() throws Exception {
        when(service.authorize("session")).thenReturn("https://kauth.kakao.com/oauth/authorize?state=test");
        mvc.perform(post("/api/v1/members/me/kakao-self/authorize").cookie(new Cookie("CHEONGYAK_SESSION","session"))
                        .header("X-CSRF-Token",codec.csrfToken("session")))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.authorizationUrl").value("https://kauth.kakao.com/oauth/authorize?state=test"));
        verify(service).authorize("session");
    }
    @Test void unauthenticatedStatusReturns401() throws Exception {
        when(service.status(null)).thenThrow(new MemberApiException(HttpStatus.UNAUTHORIZED,"AUTH_REQUIRED","로그인 필요"));
        mvc.perform(get("/api/v1/members/me/kakao-self")).andExpect(status().isUnauthorized());
    }
    @Test void callbackUsesFixedSafeDestinationWithoutCodeOrErrorsInRedirect() throws Exception {
        when(service.callback("session","state","private-code","bad-provider-detail")).thenReturn("error");
        mvc.perform(get("/api/v1/members/me/kakao-self/callback").cookie(new Cookie("CHEONGYAK_SESSION","session"))
                        .param("state","state").param("code","private-code").param("error","bad-provider-detail"))
                .andExpect(status().isSeeOther()).andExpect(header().string("Location","https://example.com/?kakaoSelf=error"))
                .andExpect(header().string("Referrer-Policy","no-referrer")).andExpect(header().string("Cache-Control","no-store"));
    }
}
