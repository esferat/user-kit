package com.acme.usermark.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

@ExtendWith(MockitoExtension.class)
class AuthSessionServiceTest {

    @Mock
    private AuthSessionRepository sessions;

    @Mock
    private AuthLoginStateRepository loginStates;

    @Mock
    private OAuthTokenClient tokenClient;

    private AuthSessionService service;

    @BeforeEach
    void setUp() {
        properties = new AppProperties(
                new AppProperties.Security(
                        new AppProperties.Oidc(true, "https://idp", "", java.util.List.of("user-kit-api"), "roles"),
                        new AppProperties.Dev(false, "user-kit-dev", "secret", Duration.ofHours(1)),
                        new AppProperties.OAuth(
                                true,
                                "user-kit-bff",
                                "s3cret",
                                "",
                                "https://app/api/v1/auth/callback",
                                "https://app/",
                                "openid profile",
                                Duration.ofMinutes(10),
                                Duration.ofHours(12),
                                Duration.ofSeconds(90),
                                false,
                                "",
                                "https://app/api/v1/auth/callback,https://other/api/v1/auth/callback",
                                "https://app/,https://other/")),
                null,
                null,
                null,
                null,
                null);
        @SuppressWarnings("unchecked")
        ObjectProvider<OAuthTokenClient> provider = org.mockito.Mockito.mock(ObjectProvider.class);
        lenient().when(provider.getIfAvailable()).thenReturn(tokenClient);
        service = new AuthSessionService(sessions, loginStates, provider, properties, new ObjectMapper());
    }

    private AppProperties properties;

    @Test
    @DisplayName("stores the login state hashed and redirects to the provider")
    void startsLogin() {
        when(tokenClient.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth?state=x");

        String url = service.startLogin(null, "https://app");

        assertThat(url).isEqualTo("https://idp/auth?state=x");
        ArgumentCaptor<AuthLoginState> saved = ArgumentCaptor.forClass(AuthLoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().getStateHash()).hasSize(64);
        assertThat(saved.getValue().getRedirectUri()).isEqualTo("https://app/");
        assertThat(saved.getValue().getCallbackUri()).isEqualTo("https://app/api/v1/auth/callback");
        assertThat(saved.getValue().isUsable(Instant.now().plusSeconds(60))).isTrue();
        assertThat(saved.getValue().isUsable(Instant.now().plusSeconds(601))).isFalse();
        verify(loginStates).deleteExpired(any(Instant.class));
    }

    @Test
    @DisplayName("sends the visitor back to the router route it came from")
    void keepsLocalReturnUrl() {
        when(tokenClient.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        service.startLogin("#/admin-users", "https://app");

        ArgumentCaptor<AuthLoginState> saved = ArgumentCaptor.forClass(AuthLoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().getRedirectUri()).isEqualTo("https://app/#/admin-users");
    }

    @Test
    @DisplayName("refuses a return URL that points at another origin")
    void dropsForeignReturnUrl() {
        when(tokenClient.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        service.startLogin("https://evil.example.com/steal", "https://app");

        ArgumentCaptor<AuthLoginState> saved = ArgumentCaptor.forClass(AuthLoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().getRedirectUri()).isEqualTo("https://app/");
    }

    @Test
    @DisplayName("refuses a callback with an unknown state")
    void rejectsUnknownState() {
        when(loginStates.findById(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.completeLogin("forged", "code"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("login state");

        verify(tokenClient, never()).exchangeCode(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("refuses a callback whose state expired")
    void rejectsExpiredState() {
        when(loginStates.findById(anyString()))
                .thenReturn(Optional.of(new AuthLoginState(
                        "hash", "https://app/", "verifier", Instant.now().minusSeconds(1))));

        assertThatThrownBy(() -> service.completeLogin("state", "code"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expired");
    }

    @Test
    @DisplayName("exchanges the code and stores the session with hashed ids")
    void completesLogin() {
        AuthLoginState loginState = new AuthLoginState("hash", "https://app/#/documents", "verifier", Instant.now().plusSeconds(60));
        when(loginStates.findById(anyString())).thenReturn(Optional.of(loginState));
        when(tokenClient.exchangeCode("code", "verifier", "https://app/api/v1/auth/callback")).thenReturn(tokens());

        AuthSessionService.LoginResult result = service.completeLogin("state", "code");

        assertThat(result.appUri()).isEqualTo("https://app/#/documents");
        assertThat(result.tokens().accessToken()).isEqualTo(accessToken("subject-1"));
        assertThat(result.sessionId()).isNotBlank();
        ArgumentCaptor<AuthSession> saved = ArgumentCaptor.forClass(AuthSession.class);
        verify(sessions).save(saved.capture());
        assertThat(saved.getValue().getIdHash()).hasSize(64).isNotEqualTo(result.sessionId());
        assertThat(saved.getValue().getSubject()).isEqualTo("subject-1");
        assertThat(saved.getValue().getClientId()).isEqualTo("user-kit-bff");
        assertThat(saved.getValue().getRefreshToken()).isEqualTo("refresh-1");
        assertThat(saved.getValue().getIdToken()).isEqualTo("id-1");
        verify(loginStates).delete(loginState);
    }

    @Test
    @DisplayName("removes only the sessions that outlived their TTL")
    void deletesExpiredSessions() {
        when(loginStates.findById(anyString()))
                .thenReturn(Optional.of(new AuthLoginState(
                        "hash", "https://app/", "verifier", Instant.now().plusSeconds(60))));
        when(tokenClient.exchangeCode(anyString(), anyString(), anyString())).thenReturn(tokens());

        service.completeLogin("state", "code");

        ArgumentCaptor<Instant> threshold = ArgumentCaptor.forClass(Instant.class);
        verify(sessions).deleteOlderThan(threshold.capture());
        assertThat(threshold.getValue()).isBefore(Instant.now().minus(Duration.ofHours(11)));
    }

    @Test
    @DisplayName("keeps the session id when the tokens are renewed")
    void refreshesSession() {
        AuthSession session = new AuthSession("hash", "subject-1", "user-kit-bff", tokens());
        when(tokenClient.refresh("refresh-1")).thenReturn(tokens());

        TokenSet renewed = service.refresh(session);

        assertThat(renewed.accessToken()).isEqualTo(accessToken("subject-1"));
        assertThat(session.getAccessTokenExpiresAt()).isEqualTo(renewed.expiresAt());
        verify(sessions).save(session);
    }

    @Test
    @DisplayName("refuses to refresh a session that has no refresh token")
    void refreshesNothingWithoutToken() {
        AuthSession session = new AuthSession(
                "hash", "subject-1", "user-kit-bff", new TokenSet("at-1", null, "id-1", Instant.now().plusSeconds(300), null));

        assertThatThrownBy(() -> service.refresh(session))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("refresh token");

        verify(sessions, never()).save(any());
    }

    @Test
    @DisplayName("drops the session and revokes the refresh token on logout")
    void closesSession() {
        AuthSession session = new AuthSession("hash", "subject-1", "user-kit-bff", tokens());

        service.closeSession("session-id", session);

        verify(sessions).deleteById(service.hash("session-id"));
        verify(tokenClient).revokeRefreshToken("refresh-1");
    }

    @Test
    @DisplayName("survives a provider that refuses the revocation")
    void keepsLogoutWorkingWhenProviderFails() {
        AuthSession session = new AuthSession("hash", "subject-1", "user-kit-bff", tokens());
        org.mockito.Mockito.doThrow(new IllegalStateException("provider down")).when(tokenClient).revokeRefreshToken(anyString());

        service.closeSession("session-id", session);

        verify(sessions).deleteById(service.hash("session-id"));
    }

    @Test
    @DisplayName("ignores an unknown or empty session id")
    void ignoresUnknownSession() {
        assertThat(service.findSession(null)).isEmpty();
        assertThat(service.findSession(" ")).isEmpty();
    }

    @Test
    @DisplayName("builds the provider logout URL from the id token of the session")
    void buildsEndSessionUrl() {
        AuthSession session = new AuthSession("hash", "subject-1", "user-kit-bff", tokens());
        when(tokenClient.endSessionUrl("id-1", "https://other/")).thenReturn(Optional.of("https://idp/logout"));

        assertThat(service.endSessionUrl(session, "https://other")).contains("https://idp/logout");
        assertThat(service.endSessionUrl(null, "https://other")).isEmpty();
    }

    @Test
    @DisplayName("keeps the callback the login announced, even when the callback arrives on another host")
    void exchangesCodeWithTheStoredCallback() {
        AuthLoginState loginState = new AuthLoginState(
                "hash", "https://other/", "https://other/api/v1/auth/callback", "verifier", Instant.now().plusSeconds(60));
        when(loginStates.findById(anyString())).thenReturn(Optional.of(loginState));
        when(tokenClient.exchangeCode("code", "verifier", "https://other/api/v1/auth/callback")).thenReturn(tokens());

        AuthSessionService.LoginResult result = service.completeLogin("state", "code");

        assertThat(result.appUri()).isEqualTo("https://other/");
    }

    @Test
    @DisplayName("starts the login of the frontend the request came from")
    void picksCallbackOfTheRequestOrigin() {
        when(tokenClient.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        service.startLogin("#/documents", "https://other");

        ArgumentCaptor<AuthLoginState> saved = ArgumentCaptor.forClass(AuthLoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().getCallbackUri()).isEqualTo("https://other/api/v1/auth/callback");
        assertThat(saved.getValue().getRedirectUri()).isEqualTo("https://other/#/documents");
    }

    @Test
    @DisplayName("falls back to the first frontend of the list when the origin is unknown")
    void fallsBackToTheFirstFrontend() {
        assertThat(service.defaultAppUri("https://unknown.example.com")).isEqualTo("https://app/");
        when(tokenClient.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        service.startLogin(null, "https://unknown.example.com");

        ArgumentCaptor<AuthLoginState> saved = ArgumentCaptor.forClass(AuthLoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().getCallbackUri()).isEqualTo("https://app/api/v1/auth/callback");
        assertThat(saved.getValue().getRedirectUri()).isEqualTo("https://app/");
    }

    private TokenSet tokens() {
        return new TokenSet(
                accessToken("subject-1"), "refresh-1", "id-1", Instant.now().plusSeconds(300), Instant.now().plusSeconds(1800));
    }

    /** Unsigned token with a payload, the service only reads the subject to label the session row. */
    private static String accessToken(String subject) {
        String payload = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(("{\"sub\":\"" + subject + "\"}").getBytes(StandardCharsets.UTF_8));
        return "header." + payload + ".signature";
    }
}