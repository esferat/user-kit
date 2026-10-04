package com.acme.usermark.dev;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issues local access tokens for the `dev` profile so the application can be
 * explored without an external identity provider. Disabled by default.
 */
@RestController
@RequestMapping(path = "/api/v1/dev", produces = MediaType.APPLICATION_JSON_VALUE)
@ConditionalOnProperty(prefix = "app.security.dev", name = "enabled", havingValue = "true")
@Tag(name = "Development", description = "Local helpers, available with the dev profile only")
public class DevTokenController {

    private final JwtEncoder jwtEncoder;
    private final AppProperties properties;

    public DevTokenController(JwtEncoder jwtEncoder, AppProperties properties) {
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
    }

    @GetMapping("/roles")
    @Operation(summary = "Lists the roles supported by the dev token endpoint")
    public List<String> roles() {
        return List.of("user", "admin");
    }

    @GetMapping("/token")
    @Operation(summary = "Issues a short lived local access token")
    public TokenResponse token(
            @RequestParam(defaultValue = "user") String role, @RequestParam(required = false) String subject) {
        String normalized = role.trim().toLowerCase();
        if (!normalized.equals("user") && !normalized.equals("admin")) {
            throw ApiException.badRequest("unknown_role", "Role must be user or admin");
        }

        AppProperties.Dev dev = properties.security().dev();
        String userSubject = subject == null || subject.isBlank() ? "dev-" + java.util.UUID.randomUUID() : subject.trim();
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

        return new TokenResponse(
                token,
                "Bearer",
                expiresAt.getEpochSecond(),
                userSubject,
                email,
                normalized.equals("admin") ? "Dev Administrator" : "Dev User",
                List.of(normalized));
    }

    public record TokenResponse(
            String accessToken,
            String tokenType,
            long expiresAt,
            String subject,
            String email,
            String displayName,
            List<String> roles) {
    }
}
