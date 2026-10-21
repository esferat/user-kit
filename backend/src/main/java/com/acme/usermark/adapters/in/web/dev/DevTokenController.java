package com.acme.usermark.adapters.in.web.dev;

import com.acme.usermark.adapters.dev.DevTokenIssuer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
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

    private final DevTokenIssuer issuer;

    public DevTokenController(DevTokenIssuer issuer) {
        this.issuer = issuer;
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
        DevTokenIssuer.DevToken token = issuer.issue(role, subject);
        return new TokenResponse(
                token.accessToken(),
                "Bearer",
                token.expiresAt(),
                token.subject(),
                token.email(),
                token.displayName(),
                token.roles());
    }

    public record TokenResponse(
            String accessToken,
            String tokenType,
            long expiresAt,
            String subject,
            String email,
            String displayName,
            List<String> roles) {}
}
