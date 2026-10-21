package com.acme.usermark.adapters.out.persistence.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Row of the {@code auth_login_state} table: a started login. */
@Entity
@Table(name = "auth_login_state")
public class AuthLoginStateRow {

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

    protected AuthLoginStateRow() {
    }

    public String getStateHash() {
        return stateHash;
    }

    public void setStateHash(String stateHash) {
        this.stateHash = stateHash;
    }

    public String getRedirectUri() {
        return redirectUri;
    }

    public void setRedirectUri(String redirectUri) {
        this.redirectUri = redirectUri;
    }

    public String getCallbackUri() {
        return callbackUri;
    }

    public void setCallbackUri(String callbackUri) {
        this.callbackUri = callbackUri;
    }

    public String getCodeVerifier() {
        return codeVerifier;
    }

    public void setCodeVerifier(String codeVerifier) {
        this.codeVerifier = codeVerifier;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}
