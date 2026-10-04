package com.acme.usermark.security;

import com.acme.usermark.config.AppProperties;
import java.util.Collection;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

@Component
public class OidcJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final String rolesClaim;
    private final List<String> audiences;

    public OidcJwtAuthenticationConverter(AppProperties properties) {
        this.rolesClaim = properties.security().oidc().rolesClaim();
        this.audiences = properties.security().oidc().audiences();
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        List<String> roles = RoleClaims.readRoles(jwt.getClaims(), rolesClaim, audiences);
        Collection<GrantedAuthority> authorities = RoleClaims.toAuthorities(roles);
        return new JwtAuthenticationToken(jwt, authorities, principalName(jwt));
    }

    private String principalName(Jwt jwt) {
        String preferred = jwt.getClaimAsString("preferred_username");
        if (preferred != null && !preferred.isBlank()) {
            return preferred;
        }
        String email = jwt.getClaimAsString("email");
        if (email != null && !email.isBlank()) {
            return email;
        }
        return jwt.getSubject();
    }
}
