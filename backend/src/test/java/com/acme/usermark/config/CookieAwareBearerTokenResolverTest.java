package com.acme.usermark.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.acme.usermark.auth.AuthCookies;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class CookieAwareBearerTokenResolverTest {

    private final CookieAwareBearerTokenResolver resolver = new CookieAwareBearerTokenResolver();

    private static MockHttpServletRequest request(String authorization, Cookie... cookies) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (authorization != null) {
            request.addHeader("Authorization", authorization);
        }
        if (cookies.length > 0) {
            request.setCookies(cookies);
        }
        return request;
    }

    @Test
    @DisplayName("prefers the header so command line clients keep working")
    void prefersHeader() {
        assertThat(resolver.resolve(request("Bearer from-header", new Cookie(AuthCookies.DEV_TOKEN, "dev-token"))))
                .isEqualTo("from-header");
    }

    @Test
    @DisplayName("accepts the header whatever its case is")
    void acceptsAnyHeaderCase() {
        assertThat(resolver.resolve(request("bearer from-header"))).isEqualTo("from-header");
    }

    @Test
    @DisplayName("ignores the access cookie, otherwise the browser would skip CSRF")
    void ignoresAccessCookie() {
        assertThat(resolver.resolve(request(null, new Cookie(AuthCookies.ACCESS_TOKEN, "from-cookie"))))
                .isNull();
    }

    @Test
    @DisplayName("also accepts the dev token of the local login")
    void readsDevCookie() {
        assertThat(resolver.resolve(request(null, new Cookie(AuthCookies.DEV_TOKEN, "dev-token"))))
                .isEqualTo("dev-token");
    }

    @Test
    @DisplayName("returns nothing without a usable header and without a cookie")
    void returnsNull() {
        assertThat(resolver.resolve(request(null))).isNull();
        assertThat(resolver.resolve(request("Basic dXNlcjpwYXNz"))).isNull();
        assertThat(resolver.resolve(request("Bearer "))).isNull();
        assertThat(resolver.resolve(request(null, new Cookie(AuthCookies.SESSION, "session-1"))))
                .isNull();
        assertThat(resolver.resolve(request(null, new Cookie(AuthCookies.DEV_TOKEN, " ")))).isNull();
    }
}
