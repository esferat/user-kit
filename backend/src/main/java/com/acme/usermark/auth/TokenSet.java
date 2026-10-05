package com.acme.usermark.auth;

import java.time.Instant;

/** Tokens of one login, as returned by the token endpoint of the identity provider. */
public record TokenSet(String accessToken, String refreshToken, String idToken, Instant expiresAt, Instant refreshExpiresAt) {

    public boolean hasRefreshToken() {
        return refreshToken != null && !refreshToken.isBlank();
    }

    /** A refresh token without an expiry date is treated as valid. */
    public boolean refreshTokenValid(Instant now) {
        return hasRefreshToken() && (refreshExpiresAt == null || refreshExpiresAt.isAfter(now));
    }
}