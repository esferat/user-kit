package com.acme.usermark.config;

import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

/**
 * Local HS256 tokens for the `dev` profile only.
 *
 * The rest of the application does not know about this mode: the tokens are
 * validated by the very same resource server filter chain.
 */
@Configuration
@ConditionalOnProperty(prefix = "app.security.dev", name = "enabled", havingValue = "true")
public class DevJwtConfiguration {

    @Bean
    SecretKey devSecretKey(AppProperties properties) {
        String secret = properties.security().dev().secret();
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.security.dev.secret must be at least 32 bytes long");
        }
        return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Bean
    JwtEncoder devJwtEncoder(SecretKey devSecretKey) {
        com.nimbusds.jose.jwk.source.JWKSource<com.nimbusds.jose.proc.SecurityContext> jwkSource =
                new com.nimbusds.jose.jwk.source.ImmutableSecret<>(devSecretKey);
        return new NimbusJwtEncoder(jwkSource);
    }

    @Bean
    JwtDecoder devJwtDecoder(SecretKey devSecretKey, AppProperties properties) {
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withSecretKey(devSecretKey).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.security().dev().issuer()));
        return decoder;
    }
}
