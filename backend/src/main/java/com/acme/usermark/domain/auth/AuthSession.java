package com.acme.usermark.domain.auth;

import java.time.Instant;

/**
 * One login of one browser. The primary key is the hash of the session id that
 * the browser holds as a cookie; the refresh token of the identity provider stays
 * here and never leaves the backend.
 */
public class AuthSession {

    private final String idHash;
    private final String subject;
    private final String clientId;
    private Instant accessTokenExpiresAt;
    private String refreshToken;
    private String idToken;
    private final Instant createdAt;
    private Instant updatedAt;

    public AuthSession(
            String idHash,
            String subject,
            String clientId,
            Instant accessTokenExpiresAt,
            String refreshToken,
            String idToken,
            Instant createdAt,
            Instant updatedAt) {
        this.idHash = idHash;
        this.subject = subject;
        this.clientId = clientId;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.refreshToken = refreshToken;
        this.idToken = idToken;
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
        this.updatedAt = updatedAt == null ? this.createdAt : updatedAt;
    }

    /** A session of a finished login. */
    public static AuthSession create(String idHash, String subject, String clientId, TokenSet tokens) {
        AuthSession session = new AuthSession(
                idHash,
                subject,
                clientId,
                tokens.expiresAt(),
                tokens.hasRefreshToken() ? tokens.refreshToken() : null,
                tokens.idToken(),
                Instant.now(),
                Instant.now());
        session.apply(tokens);
        return session;
    }

    public void apply(TokenSet tokens) {
        this.accessTokenExpiresAt = tokens.expiresAt();
        this.refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : this.refreshToken;
        this.idToken = tokens.idToken() == null ? this.idToken : tokens.idToken();
        this.updatedAt = Instant.now();
    }

    public String idHash() {
        return idHash;
    }

    public String subject() {
        return subject;
    }

    public String clientId() {
        return clientId;
    }

    public Instant accessTokenExpiresAt() {
        return accessTokenExpiresAt;
    }

    public String refreshToken() {
        return refreshToken;
    }

    public String idToken() {
        return idToken;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }
}
