package com.acme.usermark.domain.auth;

import java.util.Optional;

/**
 * Port of the identity provider. The login flow talks to this interface, the
 * adapter decides whether the provider is an OpenID Connect server, a local
 * issuer or something that is switched off.
 */
public interface IdentityProvider {

    /** False when the login is switched off on the server. */
    boolean isEnabled();

    /** Authorization URL the browser has to visit. */
    String authorizationUrl(String state, String codeChallenge, String callbackUri);

    /** Self registration page of the provider. */
    String registrationUrl(String state, String codeChallenge, String callbackUri);

    /** Exchanges the authorization code for the tokens of the session. */
    TokenSet exchangeCode(String code, String codeVerifier, String callbackUri);

    /** Renews the tokens of a session with its refresh token. */
    TokenSet refresh(String refreshToken);

    /** Best effort revocation of a refresh token. */
    void revokeRefreshToken(String refreshToken);

    /** URL that ends the session of the provider itself. */
    Optional<String> endSessionUrl(String idToken, String redirectUri);

    /**
     * The subject the access token belongs to. The label of the session row is
     * the only thing that is read from the token, it is never verified here.
     */
    String subjectOf(String accessToken);
}
