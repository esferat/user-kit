package com.acme.usermark.adapters.out.identity;

import com.acme.usermark.domain.auth.IdentityProvider;
import com.acme.usermark.domain.auth.TokenSet;
import com.acme.usermark.domain.shared.DomainException;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The identity provider of a server that runs without an OpenID Connect client.
 * Every call fails like a provider that is not reachable, so the login flow can
 * report it in the same way.
 */
@Component
@ConditionalOnProperty(prefix = "app.security.oauth", name = "enabled", havingValue = "false", matchIfMissing = true)
public class DisabledIdentityProvider implements IdentityProvider {

    private static final String MESSAGE = "The OAuth login is disabled on the server";

    @Override
    public boolean isEnabled() {
        return false;
    }

    @Override
    public String authorizationUrl(String state, String codeChallenge, String callbackUri) {
        throw DomainException.upstream(MESSAGE);
    }

    @Override
    public String registrationUrl(String state, String codeChallenge, String callbackUri) {
        throw DomainException.upstream(MESSAGE);
    }

    @Override
    public TokenSet exchangeCode(String code, String codeVerifier, String callbackUri) {
        throw DomainException.upstream(MESSAGE);
    }

    @Override
    public TokenSet refresh(String refreshToken) {
        throw DomainException.upstream(MESSAGE);
    }

    @Override
    public void revokeRefreshToken(String refreshToken) {
        // Nothing to revoke when the provider is switched off.
    }

    @Override
    public Optional<String> endSessionUrl(String idToken, String redirectUri) {
        return Optional.empty();
    }

    @Override
    public String subjectOf(String accessToken) {
        return "unknown";
    }
}
