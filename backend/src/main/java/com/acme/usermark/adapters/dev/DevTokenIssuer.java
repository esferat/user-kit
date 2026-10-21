package com.acme.usermark.adapters.dev;

import com.acme.usermark.config.AppProperties;
import com.acme.usermark.domain.shared.DomainException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Component;

/**
 * Issues local access tokens for the dev profile so the application can be
 * explored without an external identity provider. Disabled by default.
 */
@Component
@ConditionalOnProperty(prefix = "app.security.dev", name = "enabled", havingValue = "true")
public class DevTokenIssuer {

    private final JwtEncoder jwtEncoder;
    private final AppProperties properties;

    public DevTokenIssuer(JwtEncoder jwtEncoder, AppProperties properties) {
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
    }

    /** The token of a local login, together with the identity it carries. */
    public record DevToken(
            String accessToken,
            long expiresAt,
            String subject,
            String email,
            String displayName,
            List<String> roles) {}

    /**
     * Builds the token itself, so the cookie based login of the dev profile can
     * put it into an httpOnly cookie instead of handing it to the browser as a
     * response body.
     */
    public DevToken issue(String role, String subject) {
        String normalized = role == null || role.isBlank() ? "user" : role.trim().toLowerCase();
        if (!normalized.equals("user") && !normalized.equals("admin")) {
            throw DomainException.validation("unknown_role", "Role must be user or admin");
        }

        AppProperties.Dev dev = properties.security().dev();
        String userSubject = subject == null || subject.isBlank() ? "dev-" + UUID.randomUUID() : subject.trim();
        String email = userSubject.contains("@") ? userSubject : userSubject + "@dev.local";
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(dev.tokenTtl());

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(dev.issuer())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(userSubject)
                .claim("preferred_username", userSubject)
                .claim("email", email)
                .claim("name", normalized.equals("admin") ? "Dev Administrator" : "Dev User")
                .claim("roles", List.of(normalized))
                .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();

        return new DevToken(
                token,
                expiresAt.getEpochSecond(),
                userSubject,
                email,
                normalized.equals("admin") ? "Dev Administrator" : "Dev User",
                List.of(normalized));
    }
}
