package com.acme.usermark.adapters.in.security;

import com.acme.usermark.domain.account.Caller;
import com.acme.usermark.domain.shared.DomainException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Reads the principal of the request out of the security context. The web
 * adapter hands the caller over to the use cases, they never see the token.
 */
@Component
public class CallerResolver {

    /** The caller of the request, or an error when the request is not authenticated. */
    public Caller current() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication) || !authentication.isAuthenticated()) {
            throw DomainException.unauthenticated("Authentication is required");
        }
        return new Caller(jwtAuthentication.getToken().getSubject(), jwtAuthentication.getToken().getClaims());
    }
}
