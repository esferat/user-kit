package com.acme.usermark.auth;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
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
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the browser sessions of the cookie based login: the random session id and
 * login state live in cookies, the database keeps their hashes together with the
 * refresh token, so the identity provider session can be renewed silently.
 */
@Service
public class AuthSessionService {

    private static final Logger log = LoggerFactory.getLogger(AuthSessionService.class);
    private static final int SECRET_BYTES = 32;
    private static final int VERIFIER_BYTES = 32;

    private final AuthSessionRepository sessions;
    private final AuthLoginStateRepository loginStates;
    private final ObjectProvider<OAuthTokenClient> tokenClient;
    private final AppProperties properties;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();

    public AuthSessionService(
            AuthSessionRepository sessions,
            AuthLoginStateRepository loginStates,
            ObjectProvider<OAuthTokenClient> tokenClient,
            AppProperties properties,
            ObjectMapper objectMapper) {
        this.sessions = sessions;
        this.loginStates = loginStates;
        this.tokenClient = tokenClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public boolean oauthEnabled() {
        return properties.security().oauth().enabled() && tokenClient.getIfAvailable() != null;
    }

    /** A finished login: the session id goes into the cookie, the tokens stay on the server. */
    public record LoginResult(String sessionId, TokenSet tokens, String appUri) {
    }

    /** Starts a login and returns the provider URL the browser has to visit. */
    @Transactional
    public String startLogin(String returnUrl, String origin) {
        OAuthTokenClient client = requireTokenClient();
        Instant now = Instant.now();
        loginStates.deleteExpired(now);
        String state = randomValue(SECRET_BYTES);
        String codeVerifier = randomValue(VERIFIER_BYTES);
        String callbackUri = properties.security().oauth().callbackUriFor(origin);
        loginStates.save(new AuthLoginState(
                hash(state),
                appUri(returnUrl, origin),
                callbackUri,
                codeVerifier,
                now.plus(properties.security().oauth().loginStateTtl())));
        return client.authorizationUrl(state, codeChallenge(codeVerifier), callbackUri);
    }

    /**
     * Keeps the return URL inside the frontend that started the login: only a
     * fragment of the router is accepted, so a crafted link cannot turn the
     * callback into an open redirect that carries the freshly issued session
     * cookies to another origin.
     */
    private String appUri(String returnUrl, String origin) {
        String appUri = properties.security().oauth().appUriFor(origin);
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
        OAuthTokenClient client = requireTokenClient();
        Instant now = Instant.now();
        AuthLoginState loginState = loginStates
                .findById(hash(state == null ? "" : state))
                .filter(candidate -> candidate.isUsable(now))
                .orElseThrow(() -> ApiException.badRequest("auth_state_invalid", "The login state is unknown or expired"));
        loginStates.delete(loginState);
        TokenSet tokens = client.exchangeCode(code, loginState.getCodeVerifier(), callbackOf(loginState));
        sessions.deleteOlderThan(now.minus(properties.security().oauth().sessionTtl()));
        String sessionId = randomValue(SECRET_BYTES);
        sessions.save(new AuthSession(
                hash(sessionId),
                claim(tokens.accessToken(), "sub"),
                properties.security().oauth().clientId(),
                tokens));
        return new LoginResult(sessionId, tokens, loginState.getRedirectUri());
    }

    /** A state that predates several frontends carries no callback of its own. */
    private String callbackOf(AuthLoginState loginState) {
        String callbackUri = loginState.getCallbackUri();
        return callbackUri == null || callbackUri.isBlank() ? properties.security().oauth().redirectUri() : callbackUri;
    }

    /** Where the browser goes when there is no login state, for example after a failed exchange. */
    public String defaultAppUri(String origin) {
        return properties.security().oauth().appUriFor(origin);
    }

    public String newSessionId() {
        return randomValue(SECRET_BYTES);
    }

    public Optional<AuthSession> findSession(String sessionId) {
        return sessionId == null || sessionId.isBlank()
                ? Optional.empty()
                : sessions.findById(hash(sessionId));
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
        OAuthTokenClient client = tokenClient.getIfAvailable();
        return client == null
                ? Optional.empty()
                : client.endSessionUrl(
                        session == null ? null : session.getIdToken(),
                        properties.security().oauth().appUriFor(origin));
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
            OAuthTokenClient client = tokenClient.getIfAvailable();
            if (client != null) {
                client.revokeRefreshToken(session.getRefreshToken());
            }
        } catch (RuntimeException exception) {
            log.warn("The identity provider did not accept the revocation of the refresh token: {}", exception.getMessage());
        }
    }

    /** Replaces the tokens of a session, keeping the same session id. */
    @Transactional
    public TokenSet refresh(AuthSession session) {
        String refreshToken = session.getRefreshToken();
        if (refreshToken == null || refreshToken.isBlank()) {
            throw ApiException.badRequest("auth_session_unrenewable", "The session has no refresh token");
        }
        TokenSet tokens = requireTokenClient().refresh(refreshToken);
        session.apply(tokens);
        sessions.save(session);
        return tokens;
    }

    private OAuthTokenClient requireTokenClient() {
        OAuthTokenClient client = tokenClient.getIfAvailable();
        if (client == null) {
            throw ApiException.badGateway("The OAuth login is disabled on the server");
        }
        return client;
    }

    /** Reads a claim without verifying the token: it is only used to label the session row. */
    private String claim(String token, String name) {
        try {
            String payload = new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);
            JsonNode value = objectMapper.readTree(payload).get(name);
            return value == null ? "unknown" : value.asText();
        } catch (RuntimeException | IOException exception) {
            return "unknown";
        }
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