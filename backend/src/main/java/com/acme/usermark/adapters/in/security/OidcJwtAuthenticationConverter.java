package com.acme.usermark.adapters.in.security;

import com.acme.usermark.application.shared.IdentitySettings;
import com.acme.usermark.domain.account.AccountRoles;
import java.util.Collection;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Turns the access token of the identity provider into the authentication of the request. */
@Component
public class OidcJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final IdentitySettings settings;

    public OidcJwtAuthenticationConverter(IdentitySettings settings) {
        this.settings = settings;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        List<String> roles = AccountRoles.readRoles(jwt.getClaims(), settings.rolesClaim(), settings.audiences());
        Collection<GrantedAuthority> authorities = RoleAuthorities.toAuthorities(roles);
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
