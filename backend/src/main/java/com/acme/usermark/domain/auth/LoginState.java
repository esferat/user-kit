package com.acme.usermark.domain.auth;

import java.time.Instant;

/** A started login: the state protects the code exchange, the verifier the PKCE. */
public class LoginState {

    private final String stateHash;
    private final String redirectUri;
    private final String callbackUri;
    private final String codeVerifier;
    private final Instant createdAt;
    private final Instant expiresAt;

    public LoginState(
            String stateHash,
            String redirectUri,
            String callbackUri,
            String codeVerifier,
            Instant createdAt,
            Instant expiresAt) {
        this.stateHash = stateHash;
        this.redirectUri = redirectUri;
        this.callbackUri = callbackUri;
        this.codeVerifier = codeVerifier;
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
        this.expiresAt = expiresAt;
    }

    public boolean isUsable(Instant now) {
        return expiresAt.isAfter(now);
    }

    public String stateHash() {
        return stateHash;
    }

    /** Frontend the browser returns to after the callback. */
    public String redirectUri() {
        return redirectUri;
    }

    /**
     * Callback that was sent to the provider. The code exchange has to repeat it
     * verbatim, and it is what tells a login of one frontend from the login of
     * the other one. Null for a row that was started before several frontends
     * existed.
     */
    public String callbackUri() {
        return callbackUri;
    }

    public String codeVerifier() {
        return codeVerifier;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant expiresAt() {
        return expiresAt;
    }
}
