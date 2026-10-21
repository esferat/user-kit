package com.acme.usermark.application.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.domain.auth.AuthSession;
import com.acme.usermark.domain.auth.IdentityProvider;
import com.acme.usermark.domain.auth.LoginState;
import com.acme.usermark.domain.auth.LoginStateRepository;
import com.acme.usermark.domain.auth.SessionRepository;
import com.acme.usermark.domain.auth.TokenSet;
import com.acme.usermark.domain.shared.DomainException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuthenticationUseCasesTest {

    @Mock
    private SessionRepository sessions;

    @Mock
    private LoginStateRepository loginStates;

    @Mock
    private IdentityProvider identityProvider;

    private AuthenticationUseCases useCases;

    @BeforeEach
    void setUp() {
        lenient().when(identityProvider.isEnabled()).thenReturn(true);
        useCases = new AuthenticationUseCases(sessions, loginStates, identityProvider, settings());
    }

    private OAuthSettings settings() {
        return new OAuthSettings(
                "user-kit-bff",
                "https://app/api/v1/auth/callback",
                Duration.ofHours(12),
                Duration.ofMinutes(10),
                List.of("https://app/api/v1/auth/callback", "https://other/api/v1/auth/callback"),
                List.of("https://app/", "https://other/"));
    }

    @Test
    @DisplayName("stores the login state hashed and redirects to the provider")
    void startsLogin() {
        when(identityProvider.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth?state=x");

        String url = useCases.startLogin(null, "https://app");

        assertThat(url).isEqualTo("https://idp/auth?state=x");
        ArgumentCaptor<LoginState> saved = ArgumentCaptor.forClass(LoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().stateHash()).hasSize(64);
        assertThat(saved.getValue().redirectUri()).isEqualTo("https://app/");
        assertThat(saved.getValue().callbackUri()).isEqualTo("https://app/api/v1/auth/callback");
        assertThat(saved.getValue().isUsable(Instant.now().plusSeconds(60))).isTrue();
        assertThat(saved.getValue().isUsable(Instant.now().plusSeconds(601))).isFalse();
        verify(loginStates).deleteExpired(any(Instant.class));
    }

    @Test
    @DisplayName("starts the self registration and stores the same login state")
    void startsRegistration() {
        when(identityProvider.registrationUrl(anyString(), anyString(), anyString()))
                .thenReturn("https://idp/registrations?state=x");

        String url = useCases.startRegistration(null, "https://app");

        assertThat(url).isEqualTo("https://idp/registrations?state=x");
        ArgumentCaptor<LoginState> saved = ArgumentCaptor.forClass(LoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().stateHash()).hasSize(64);
        assertThat(saved.getValue().callbackUri()).isEqualTo("https://app/api/v1/auth/callback");
        verify(loginStates).deleteExpired(any(Instant.class));
    }

    @Test
    @DisplayName("sends the visitor back to the router route it came from")
    void keepsLocalReturnUrl() {
        when(identityProvider.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        useCases.startLogin("#/admin-users", "https://app");

        ArgumentCaptor<LoginState> saved = ArgumentCaptor.forClass(LoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().redirectUri()).isEqualTo("https://app/#/admin-users");
    }

    @Test
    @DisplayName("refuses a return URL that points at another origin")
    void dropsForeignReturnUrl() {
        when(identityProvider.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        useCases.startLogin("https://evil.example.com/steal", "https://app");

        ArgumentCaptor<LoginState> saved = ArgumentCaptor.forClass(LoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().redirectUri()).isEqualTo("https://app/");
    }

    @Test
    @DisplayName("refuses a callback with an unknown state")
    void rejectsUnknownState() {
        when(loginStates.findById(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCases.completeLogin("forged", "code"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("login state");

        verify(identityProvider, never()).exchangeCode(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("refuses a callback whose state expired")
    void rejectsExpiredState() {
        when(loginStates.findById(anyString()))
                .thenReturn(Optional.of(new LoginState(
                        "hash", "https://app/", null, "verifier", Instant.now().minusSeconds(1), Instant.now().minusSeconds(1))));

        assertThatThrownBy(() -> useCases.completeLogin("state", "code"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("expired");
    }

    @Test
    @DisplayName("exchanges the code and stores the session with hashed ids")
    void completesLogin() {
        LoginState loginState = new LoginState(
                "hash", "https://app/#/documents", null, "verifier", Instant.now(), Instant.now().plusSeconds(60));
        when(loginStates.findById(anyString())).thenReturn(Optional.of(loginState));
        when(identityProvider.exchangeCode("code", "verifier", "https://app/api/v1/auth/callback")).thenReturn(tokens());
        when(identityProvider.subjectOf(anyString())).thenReturn("subject-1");

        AuthenticationUseCases.LoginResult result = useCases.completeLogin("state", "code");

        assertThat(result.appUri()).isEqualTo("https://app/#/documents");
        assertThat(result.tokens().accessToken()).isEqualTo("access-1");
        assertThat(result.sessionId()).isNotBlank();
        ArgumentCaptor<AuthSession> saved = ArgumentCaptor.forClass(AuthSession.class);
        verify(sessions).save(saved.capture());
        assertThat(saved.getValue().idHash()).hasSize(64).isNotEqualTo(result.sessionId());
        assertThat(saved.getValue().subject()).isEqualTo("subject-1");
        assertThat(saved.getValue().clientId()).isEqualTo("user-kit-bff");
        assertThat(saved.getValue().refreshToken()).isEqualTo("refresh-1");
        assertThat(saved.getValue().idToken()).isEqualTo("id-1");
        verify(loginStates).delete(loginState);
    }

    @Test
    @DisplayName("removes only the sessions that outlived their TTL")
    void deletesExpiredSessions() {
        when(loginStates.findById(anyString()))
                .thenReturn(Optional.of(new LoginState(
                        "hash", "https://app/", null, "verifier", Instant.now(), Instant.now().plusSeconds(60))));
        when(identityProvider.exchangeCode(anyString(), anyString(), anyString())).thenReturn(tokens());
        when(identityProvider.subjectOf(anyString())).thenReturn("subject-1");

        useCases.completeLogin("state", "code");

        ArgumentCaptor<Instant> threshold = ArgumentCaptor.forClass(Instant.class);
        verify(sessions).deleteOlderThan(threshold.capture());
        assertThat(threshold.getValue()).isBefore(Instant.now().minus(Duration.ofHours(11)));
    }

    @Test
    @DisplayName("keeps the session id when the tokens are renewed")
    void refreshesSession() {
        AuthSession session = AuthSession.create("hash", "subject-1", "user-kit-bff", tokens());
        when(identityProvider.refresh("refresh-1")).thenReturn(tokens());

        TokenSet renewed = useCases.refresh(session);

        assertThat(renewed.accessToken()).isEqualTo("access-1");
        assertThat(session.accessTokenExpiresAt()).isEqualTo(renewed.expiresAt());
        verify(sessions).save(session);
    }

    @Test
    @DisplayName("refuses to refresh a session that has no refresh token")
    void refreshesNothingWithoutToken() {
        AuthSession session = AuthSession.create(
                "hash", "subject-1", "user-kit-bff", new TokenSet("at-1", null, "id-1", Instant.now().plusSeconds(300), null));

        assertThatThrownBy(() -> useCases.refresh(session))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("refresh token");

        verify(sessions, never()).save(any());
    }

    @Test
    @DisplayName("drops the session and revokes the refresh token on logout")
    void closesSession() {
        AuthSession session = AuthSession.create("hash", "subject-1", "user-kit-bff", tokens());

        useCases.closeSession("session-id", session);

        verify(sessions).deleteById(useCases.hash("session-id"));
        verify(identityProvider).revokeRefreshToken("refresh-1");
    }

    @Test
    @DisplayName("survives a provider that refuses the revocation")
    void keepsLogoutWorkingWhenProviderFails() {
        AuthSession session = AuthSession.create("hash", "subject-1", "user-kit-bff", tokens());
        org.mockito.Mockito.doThrow(new IllegalStateException("provider down"))
                .when(identityProvider)
                .revokeRefreshToken(anyString());

        useCases.closeSession("session-id", session);

        verify(sessions).deleteById(useCases.hash("session-id"));
    }

    @Test
    @DisplayName("ignores an unknown or empty session id")
    void ignoresUnknownSession() {
        assertThat(useCases.findSession(null)).isEmpty();
        assertThat(useCases.findSession(" ")).isEmpty();
    }

    @Test
    @DisplayName("builds the provider logout URL from the id token of the session")
    void buildsEndSessionUrl() {
        AuthSession session = AuthSession.create("hash", "subject-1", "user-kit-bff", tokens());
        when(identityProvider.endSessionUrl("id-1", "https://other/")).thenReturn(Optional.of("https://idp/logout"));

        assertThat(useCases.endSessionUrl(session, "https://other")).contains("https://idp/logout");
        assertThat(useCases.endSessionUrl(null, "https://other")).isEmpty();
    }

    @Test
    @DisplayName("keeps the callback the login announced, even when the callback arrives on another host")
    void exchangesCodeWithTheStoredCallback() {
        LoginState loginState = new LoginState(
                "hash",
                "https://other/",
                "https://other/api/v1/auth/callback",
                "verifier",
                Instant.now(),
                Instant.now().plusSeconds(60));
        when(loginStates.findById(anyString())).thenReturn(Optional.of(loginState));
        when(identityProvider.exchangeCode("code", "verifier", "https://other/api/v1/auth/callback")).thenReturn(tokens());
        when(identityProvider.subjectOf(anyString())).thenReturn("subject-1");

        AuthenticationUseCases.LoginResult result = useCases.completeLogin("state", "code");

        assertThat(result.appUri()).isEqualTo("https://other/");
    }

    @Test
    @DisplayName("starts the login of the frontend the request came from")
    void picksCallbackOfTheRequestOrigin() {
        when(identityProvider.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        useCases.startLogin("#/documents", "https://other");

        ArgumentCaptor<LoginState> saved = ArgumentCaptor.forClass(LoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().callbackUri()).isEqualTo("https://other/api/v1/auth/callback");
        assertThat(saved.getValue().redirectUri()).isEqualTo("https://other/#/documents");
    }

    @Test
    @DisplayName("falls back to the first frontend of the list when the origin is unknown")
    void fallsBackToTheFirstFrontend() {
        assertThat(useCases.defaultAppUri("https://unknown.example.com")).isEqualTo("https://app/");
        when(identityProvider.authorizationUrl(anyString(), anyString(), anyString())).thenReturn("https://idp/auth");

        useCases.startLogin(null, "https://unknown.example.com");

        ArgumentCaptor<LoginState> saved = ArgumentCaptor.forClass(LoginState.class);
        verify(loginStates).save(saved.capture());
        assertThat(saved.getValue().callbackUri()).isEqualTo("https://app/api/v1/auth/callback");
        assertThat(saved.getValue().redirectUri()).isEqualTo("https://app/");
    }

    @Test
    @DisplayName("reports a server without an identity provider")
    void reportsDisabledProvider() {
        when(identityProvider.isEnabled()).thenReturn(false);

        assertThat(useCases.oauthEnabled()).isFalse();
        assertThatThrownBy(() -> useCases.startLogin(null, "https://app"))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("disabled");
    }

    private TokenSet tokens() {
        return new TokenSet(
                "access-1", "refresh-1", "id-1", Instant.now().plusSeconds(300), Instant.now().plusSeconds(1800));
    }
}
