package com.acme.usermark.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * One login of one browser. The primary key is the hash of the session id that
 * the browser holds as a cookie; the refresh token of the identity provider stays
 * here and never leaves the backend.
 */
@Entity
@Table(name = "auth_session")
public class AuthSession {

    @Id
    @Column(name = "id_hash", length = 64)
    private String idHash;

    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @Column(name = "client_id", nullable = false, length = 255)
    private String clientId;

    @Column(name = "access_token_expires_at", nullable = false)
    private Instant accessTokenExpiresAt;

    @Column(name = "refresh_token")
    private String refreshToken;

    @Column(name = "id_token")
    private String idToken;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected AuthSession() {
    }

    public AuthSession(String idHash, String subject, String clientId, TokenSet tokens) {
        this.idHash = idHash;
        this.subject = subject;
        this.clientId = clientId;
        apply(tokens);
    }

    public void apply(TokenSet tokens) {
        this.accessTokenExpiresAt = tokens.expiresAt();
        this.refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : this.refreshToken;
        this.idToken = tokens.idToken() == null ? this.idToken : tokens.idToken();
        this.updatedAt = Instant.now();
    }

    public String getIdHash() {
        return idHash;
    }

    public String getSubject() {
        return subject;
    }

    public String getClientId() {
        return clientId;
    }

    public Instant getAccessTokenExpiresAt() {
        return accessTokenExpiresAt;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public String getIdToken() {
        return idToken;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}