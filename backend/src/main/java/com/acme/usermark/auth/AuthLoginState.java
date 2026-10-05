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

    @Column(name = "redirect_uri", nullable = false, length = 512)
    private String redirectUri;

    @Column(name = "code_verifier", nullable = false, length = 128)
    private String codeVerifier;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    protected AuthLoginState() {
    }

    public AuthLoginState(String stateHash, String redirectUri, String codeVerifier, Instant expiresAt) {
        this.stateHash = stateHash;
        this.redirectUri = redirectUri;
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