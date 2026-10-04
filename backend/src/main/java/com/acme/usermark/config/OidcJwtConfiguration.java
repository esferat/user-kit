package com.acme.usermark.config;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Token validation against the configured OpenID Connect provider. Any provider that
 * publishes a discovery document works, the local Keycloak of docker compose included.
 */
@Configuration
@ConditionalOnProperty(prefix = "app.security.oidc", name = "enabled", havingValue = "true", matchIfMissing = true)
public class OidcJwtConfiguration {

    @Bean("oidcJwtDecoder")
    JwtDecoder oidcJwtDecoder(AppProperties properties) {
        AppProperties.Oidc oidc = properties.security().oidc();
        if (!oidc.usable()) {
            throw new IllegalStateException(
                    "app.security.oidc.issuer-uri (OIDC_ISSUER_URI) must be set when OIDC is enabled");
        }

        JwtDecoder decoder = oidc.splitKeyLocation()
                // The issuer stays the externally visible URL, only the key lookup
                // is redirected, which avoids a TLS or DNS dependency on it.
                ? NimbusJwtDecoder.withJwkSetUri(oidc.jwkSetUri()).build()
                : JwtDecoders.fromIssuerLocation(oidc.issuerUri());
        OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(oidc.issuerUri());
        OAuth2TokenValidator<Jwt> audienceValidator = audienceValidator(oidc.audiences());
        if (decoder instanceof NimbusJwtDecoder nimbus) {
            nimbus.setJwtValidator(new DelegatingOAuth2TokenValidator<>(issuerValidator, audienceValidator));
        }
        return decoder;
    }

    private OAuth2TokenValidator<Jwt> audienceValidator(List<String> audiences) {
        return jwt -> {
            if (audiences.isEmpty()) {
                return OAuth2TokenValidatorResult.success();
            }
            List<String> present = jwt.getAudience();
            boolean valid = present != null && present.stream().anyMatch(audiences::contains);
            return valid
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error(
                            "invalid_token", "The token audience does not match this API", null));
        };
    }
}
