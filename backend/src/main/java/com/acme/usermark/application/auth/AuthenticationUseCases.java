package com.acme.usermark.application.auth;

import com.acme.usermark.domain.auth.AuthSession;
import com.acme.usermark.domain.auth.IdentityProvider;
import com.acme.usermark.domain.auth.LoginState;
import com.acme.usermark.domain.auth.LoginStateRepository;
import com.acme.usermark.domain.auth.SessionRepository;
import com.acme.usermark.domain.auth.TokenSet;
import com.acme.usermark.domain.shared.DomainException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the browser sessions of the cookie based login: the random session id and
 * the login state live in cookies, the database keeps their hashes together with
 * the refresh token, so the identity provider session can be renewed silently.
 */
@Component
public class AuthenticationUseCases {

    private static final Logger log = LoggerFactory.getLogger(AuthenticationUseCases.class);
    private static final int SECRET_BYTES = 32;
    private static final int VERIFIER_BYTES = 32;

    private final SessionRepository sessions;
    private final LoginStateRepository loginStates;
    private final IdentityProvider identityProvider;
    private final OAuthSettings settings;
    private final SecureRandom random = new SecureRandom();

    public AuthenticationUseCases(
            SessionRepository sessions,
            LoginStateRepository loginStates,
            IdentityProvider identityProvider,
            OAuthSettings settings) {
        this.sessions = sessions;
        this.loginStates = loginStates;
        this.identityProvider = identityProvider;
        this.settings = settings;
    }

    public boolean oauthEnabled() {
        return identityProvider.isEnabled();
    }

    /** A finished login: the session id goes into the cookie, the tokens stay on the server. */
    public record LoginResult(String sessionId, TokenSet tokens, String appUri) {}

    /** Starts a login and returns the provider URL the browser has to visit. */
    @Transactional
    public String startLogin(String returnUrl, String origin) {
        return start(returnUrl, origin, false);
    }

    /** Starts a self registration in the provider, the callback is the one of a login. */
    @Transactional
    public String startRegistration(String returnUrl, String origin) {
        return start(returnUrl, origin, true);
    }

    private String start(String returnUrl, String origin, boolean registration) {
        IdentityProvider provider = requireProvider();
        Instant now = Instant.now();
        loginStates.deleteExpired(now);
        String state = randomValue(SECRET_BYTES);
        String codeVerifier = randomValue(VERIFIER_BYTES);
        String callbackUri = settings.callbackUriFor(origin);
        loginStates.save(new LoginState(
                hash(state),
                appUri(returnUrl, origin),
                callbackUri,
                codeVerifier,
                now,
                now.plus(settings.loginStateTtl())));
        return registration
                ? provider.registrationUrl(state, codeChallenge(codeVerifier), callbackUri)
                : provider.authorizationUrl(state, codeChallenge(codeVerifier), callbackUri);
    }

    /**
     * Keeps the return URL inside the frontend that started the login: only a
     * fragment of the router is accepted, so a crafted link cannot turn the
     * callback into an open redirect that carries the freshly issued session
     * cookies to another origin.
     */
    private String appUri(String returnUrl, String origin) {
        String appUri = settings.appUriFor(origin);
        if (returnUrl == null || returnUrl.isBlank()) {
            return appUri;
        }
        String candidate = returnUrl.trim();
        if (candidate.length() < 2 || !candidate.startsWith("#") || appUri.contains("#")) {
            log.info("The return URL of a login is not a local route, the default page is used instead");
            return appUri;
        }
        return appUri + candidate;
    }

    /** Consumes the state and exchanges the code, returning the session to hand to the browser. */
    @Transactional
    public LoginResult completeLogin(String state, String code) {
        IdentityProvider provider = requireProvider();
        Instant now = Instant.now();
        LoginState loginState = loginStates
                .findById(hash(state == null ? "" : state))
                .filter(candidate -> candidate.isUsable(now))
                .orElseThrow(() -> DomainException.validation("auth_state_invalid", "The login state is unknown or expired"));
        loginStates.delete(loginState);
        TokenSet tokens = provider.exchangeCode(code, loginState.codeVerifier(), callbackOf(loginState));
        sessions.deleteOlderThan(now.minus(settings.sessionTtl()));
        String sessionId = randomValue(SECRET_BYTES);
        sessions.save(AuthSession.create(
                hash(sessionId),
                provider.subjectOf(tokens.accessToken()),
                settings.clientId(),
                tokens));
        return new LoginResult(sessionId, tokens, loginState.redirectUri());
    }

    /** A state that predates several frontends carries no callback of its own. */
    private String callbackOf(LoginState loginState) {
        String callbackUri = loginState.callbackUri();
        return callbackUri == null || callbackUri.isBlank() ? settings.defaultCallbackUri() : callbackUri;
    }

    /** Where the browser goes when there is no login state, for example after a failed exchange. */
    public String defaultAppUri(String origin) {
        return settings.appUriFor(origin);
    }

    public String newSessionId() {
        return randomValue(SECRET_BYTES);
    }

    public Optional<AuthSession> findSession(String sessionId) {
        return sessionId == null || sessionId.isBlank() ? Optional.empty() : sessions.findById(hash(sessionId));
    }

    public String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    /** URL that ends the session of the provider, so the next login asks for credentials again. */
    public Optional<String> endSessionUrl(AuthSession session, String origin) {
        if (!identityProvider.isEnabled()) {
            return Optional.empty();
        }
        return identityProvider.endSessionUrl(
                session == null ? null : session.idToken(), settings.appUriFor(origin));
    }

    /** Drops the local session and asks the provider to forget the refresh token. */
    @Transactional
    public void closeSession(String sessionId, AuthSession session) {
        if (sessionId != null) {
            sessions.deleteById(hash(sessionId));
        }
        if (session == null) {
            return;
        }
        try {
            if (identityProvider.isEnabled()) {
                identityProvider.revokeRefreshToken(session.refreshToken());
            }
        } catch (RuntimeException exception) {
            log.warn("The identity provider did not accept the revocation of the refresh token: {}", exception.getMessage());
        }
    }

    /** Replaces the tokens of a session, keeping the same session id. */
    @Transactional
    public TokenSet refresh(AuthSession session) {
        String refreshToken = session.refreshToken();
        if (refreshToken == null || refreshToken.isBlank()) {
            throw DomainException.validation("auth_session_unrenewable", "The session has no refresh token");
        }
        TokenSet tokens = requireProvider().refresh(refreshToken);
        session.apply(tokens);
        sessions.save(session);
        return tokens;
    }

    private IdentityProvider requireProvider() {
        if (!identityProvider.isEnabled()) {
            throw DomainException.upstream("The OAuth login is disabled on the server");
        }
        return identityProvider;
    }

    private String randomValue(int bytes) {
        byte[] value = new byte[bytes];
        random.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private String codeChallenge(String codeVerifier) {
        try {
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(MessageDigest.getInstance("SHA-256").digest(codeVerifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
