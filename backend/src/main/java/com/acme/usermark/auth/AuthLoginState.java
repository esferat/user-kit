package com.acme.usermark.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A started login: the state protects the code exchange, the verifier the PKCE. */
@Entity
@Table(name = "auth_login_state")
public class AuthLoginState {

    @Id
    @Column(name = "state_hash", length = 64)
    private String stateHash;

    /** Frontend the browser returns to after the callback. */
    @Column(name = "redirect_uri", nullable = false, length = 512)
    private String redirectUri;

    /**
     * Callback that was sent to the provider. The code exchange has to repeat it
     * verbatim, and it is what tells a login of one frontend from a login of the
     * other one. Null for a row that was started before several frontends existed.
     */
    @Column(name = "callback_uri", length = 512)
    private String callbackUri;

    @Column(name = "code_verifier", nullable = false, length = 128)
    private String codeVerifier;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    protected AuthLoginState() {
    }

    public AuthLoginState(String stateHash, String redirectUri, String codeVerifier, Instant expiresAt) {
        this(stateHash, redirectUri, null, codeVerifier, expiresAt);
    }

    public AuthLoginState(
            String stateHash, String redirectUri, String callbackUri, String codeVerifier, Instant expiresAt) {
        this.stateHash = stateHash;
        this.redirectUri = redirectUri;
        this.callbackUri = callbackUri;
        this.codeVerifier = codeVerifier;
        this.expiresAt = expiresAt;
    }

    public boolean isUsable(Instant now) {
        return expiresAt.isAfter(now);
    }

    public String getStateHash() {
        return stateHash;
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public String getCallbackUri() {
        return callbackUri;
    }

    public String getCodeVerifier() {
        return codeVerifier;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}