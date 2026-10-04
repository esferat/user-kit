package com.acme.usermark.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import com.acme.usermark.config.AppProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class OidcJwtAuthenticationConverterTest {

    private static final AppProperties PROPERTIES = new AppProperties(
            new AppProperties.Security(
                    new AppProperties.Oidc(true, "https://idp.example.com", "", List.of("user-kit-api"), "roles"), null),
            null,
            null,
            null,
            null);

    private final OidcJwtAuthenticationConverter converter = new OidcJwtAuthenticationConverter(PROPERTIES);

    private JwtAuthenticationToken convert(Map<String, Object> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("token").header("alg", "none").subject("sub-1").claim("scope", "openid");
        claims.forEach(builder::claim);
        return (JwtAuthenticationToken) converter.convert(builder.build());
    }

    @Test
    @DisplayName("maps the admin role to ROLE_ADMIN")
    void mapsAdmin() {
        JwtAuthenticationToken token = convert(Map.of("roles", List.of("admin")));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_ADMIN");
    }

    @Test
    @DisplayName("maps the user role to ROLE_USER")
    void mapsUser() {
        JwtAuthenticationToken token = convert(Map.of("roles", List.of("user")));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("falls back to the base user role for unknown claims")
    void fallsBackToUser() {
        JwtAuthenticationToken token = convert(Map.of("unrelated", "value"));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("ignores roles outside the supported set")
    void ignoresUnsupportedRoles() {
        JwtAuthenticationToken token = convert(Map.of("roles", List.of("root", "admin")));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_ADMIN");
    }

    @Test
    @DisplayName("reads nested claim structures")
    void readsNestedClaims() {
        JwtAuthenticationToken token = convert(Map.of("realm_access", Map.of("roles", List.of("admin"))));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_ADMIN");
    }

    @Test
    @DisplayName("prefers preferred_username as principal name")
    void prefersPreferredUsername() {
        JwtAuthenticationToken token = convert(Map.of("preferred_username", "jane", "email", "jane@example.com"));

        assertThat(token.getName()).isEqualTo("jane");
    }

    @Test
    @DisplayName("reads client roles from resource_access for the accepted audience")
    void readsClientRoles() {
        JwtAuthenticationToken token = convert(Map.of("resource_access", Map.of("user-kit-api", Map.of("roles", List.of("admin")))));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_ADMIN");
    }

    @Test
    @DisplayName("ignores client roles of other audiences")
    void ignoresForeignClientRoles() {
        JwtAuthenticationToken token = convert(Map.of("resource_access", Map.of("other-api", Map.of("roles", List.of("admin")))));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("prefers the configured claim over resource_access")
    void prefersConfiguredClaim() {
        JwtAuthenticationToken token = convert(Map.of(
                "roles",
                List.of("user"),
                "resource_access",
                Map.of("user-kit-api", Map.of("roles", List.of("admin")))));

        assertThat(token.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_USER");
    }
}
