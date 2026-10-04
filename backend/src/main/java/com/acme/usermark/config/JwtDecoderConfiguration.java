package com.acme.usermark.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

/**
 * Single decoder for the API. While the local token issuer of the dev profile and
 * the identity provider are both active, a token is accepted when either of them
 * validates it, which keeps /api/v1/dev/token usable for tests without weakening
 * the production profile: there DEV_AUTH_ENABLED is false and only the identity
 * provider decoder remains.
 */
@Configuration
public class JwtDecoderConfiguration {

    @Bean
    @Primary
    JwtDecoder jwtDecoder(
            @Qualifier("oidcJwtDecoder") ObjectProvider<JwtDecoder> oidcDecoder,
            @Qualifier("devJwtDecoder") ObjectProvider<JwtDecoder> devDecoder) {
        List<JwtDecoder> decoders = new ArrayList<>();
        JwtDecoder oidc = oidcDecoder.getIfAvailable();
        if (oidc != null) {
            decoders.add(oidc);
        }
        JwtDecoder dev = devDecoder.getIfAvailable();
        if (dev != null) {
            decoders.add(dev);
        }
        return combine(decoders);
    }

    static JwtDecoder combine(List<JwtDecoder> decoders) {
        if (decoders.isEmpty()) {
            throw new IllegalStateException("No JwtDecoder configured, enable the identity provider or the dev profile");
        }
        if (decoders.size() == 1) {
            return decoders.get(0);
        }
        return token -> {
            JwtException failure = null;
            for (JwtDecoder decoder : decoders) {
                try {
                    Jwt jwt = decoder.decode(token);
                    if (jwt != null) {
                        return jwt;
                    }
                    failure = new JwtException("No decoder accepted the token");
                } catch (JwtException exception) {
                    failure = exception;
                }
            }
            throw failure == null ? new JwtException("No decoder accepted the token") : failure;
        };
    }
}
