package com.acme.usermark.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class JwtDecoderConfigurationTest {

    private static final Jwt OIDC_TOKEN =
            Jwt.withTokenValue("oidc").header("alg", "RS256").subject("sub-1").build();
    private static final Jwt DEV_TOKEN =
            Jwt.withTokenValue("dev").header("alg", "HS256").subject("sub-1").build();

    /** Stands in for a decoder that knows a single issuer, Keycloak or the dev profile. */
    private static JwtDecoder onlyAccepting(Jwt token) {
        return value -> {
            if (token.getTokenValue().equals(value)) {
                return token;
            }
            throw new JwtException("rejected");
        };
    }

    private static JwtDecoder rejectingEverything() {
        return value -> {
            throw new JwtException("rejected");
        };
    }

    @Test
    @DisplayName("a single decoder is used as is")
    void singleDecoder() {
        JwtDecoder decoder = JwtDecoderConfiguration.combine(List.of(onlyAccepting(DEV_TOKEN)));

        assertThat(decoder.decode("dev")).isEqualTo(DEV_TOKEN);
    }

    @Test
    @DisplayName("a token of any configured issuer is accepted")
    void combinedDecoderAcceptsBothIssuers() {
        JwtDecoder decoder =
                JwtDecoderConfiguration.combine(List.of(onlyAccepting(OIDC_TOKEN), onlyAccepting(DEV_TOKEN)));

        assertThat(decoder.decode("oidc")).isEqualTo(OIDC_TOKEN);
        assertThat(decoder.decode("dev")).isEqualTo(DEV_TOKEN);
    }

    @Test
    @DisplayName("an unknown token is still rejected with both issuers configured")
    void combinedDecoderRejectsUnknownToken() {
        JwtDecoder decoder = JwtDecoderConfiguration.combine(
                List.of(onlyAccepting(OIDC_TOKEN), rejectingEverything()));

        assertThatThrownBy(() -> decoder.decode("forged")).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("a configuration without any decoder fails fast")
    void emptyConfiguration() {
        assertThatThrownBy(() -> JwtDecoderConfiguration.combine(List.of()))
                .isInstanceOf(IllegalStateException.class);
    }
}
