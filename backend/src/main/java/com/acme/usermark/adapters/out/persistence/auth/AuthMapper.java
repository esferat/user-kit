package com.acme.usermark.adapters.out.persistence.auth;

import com.acme.usermark.domain.auth.AuthSession;
import com.acme.usermark.domain.auth.LoginState;
import com.acme.usermark.domain.auth.TokenSet;

/** Maps the rows of the login onto the aggregates of the domain and back. */
final class AuthMapper {

    private AuthMapper() {
    }

    static AuthSession sessionToDomain(AuthSessionRow row) {
        return new AuthSession(
                row.getIdHash(),
                row.getSubject(),
                row.getClientId(),
                row.getAccessTokenExpiresAt(),
                row.getRefreshToken(),
                row.getIdToken(),
                row.getCreatedAt(),
                row.getUpdatedAt());
    }

    /** Writes the state of the session into the row. */
    static void applySession(AuthSession session, AuthSessionRow row) {
        row.setIdHash(session.idHash());
        row.setSubject(session.subject());
        row.setClientId(session.clientId());
        row.setAccessTokenExpiresAt(session.accessTokenExpiresAt());
        row.setRefreshToken(session.refreshToken());
        row.setIdToken(session.idToken());
        row.setUpdatedAt(session.updatedAt());
    }

    static LoginState stateToDomain(AuthLoginStateRow row) {
        return new LoginState(
                row.getStateHash(),
                row.getRedirectUri(),
                row.getCallbackUri(),
                row.getCodeVerifier(),
                row.getCreatedAt(),
                row.getExpiresAt());
    }

    /** Writes the state of a started login into the row. */
    static void applyState(LoginState state, AuthLoginStateRow row) {
        row.setStateHash(state.stateHash());
        row.setRedirectUri(state.redirectUri());
        row.setCallbackUri(state.callbackUri());
        row.setCodeVerifier(state.codeVerifier());
        row.setExpiresAt(state.expiresAt());
    }

    /** The tokens of a session, used when the session is renewed. */
    static void applyTokens(TokenSet tokens, AuthSessionRow row) {
        row.setAccessTokenExpiresAt(tokens.expiresAt());
        if (tokens.hasRefreshToken()) {
            row.setRefreshToken(tokens.refreshToken());
        }
        if (tokens.idToken() != null) {
            row.setIdToken(tokens.idToken());
        }
    }
}
