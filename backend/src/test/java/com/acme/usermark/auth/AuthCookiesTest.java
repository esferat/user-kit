package com.acme.usermark.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.acme.usermark.config.AppProperties;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AuthCookiesTest {

    private static AuthCookies cookies(boolean secure, String domain) {
        AppProperties properties = new AppProperties(
                new AppProperties.Security(
                        new AppProperties.Oidc(false, "", "", java.util.List.of(), "roles"),
                        new AppProperties.Dev(true, "user-kit-dev", "secret", Duration.ofHours(1)),
                        new AppProperties.OAuth(
                                true,
                                "user-kit-bff",
                                "s3cret",
                                "",
                                "https://app/api/v1/auth/callback",
                                "https://app/",
                                "openid",
                                Duration.ofMinutes(10),
                                Duration.ofHours(12),
                                Duration.ofSeconds(90),
                                secure,
                                domain,
                                "",
                                "")),
                null,
                null,
                null,
                null,
                null);
        return new AuthCookies(properties);
    }

    private static MockHttpServletResponse response() {
        return new MockHttpServletResponse();
    }

    private static String setCookie(MockHttpServletResponse response, String name) {
        return response.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(value -> value.startsWith(name + "="))
                .findFirst()
                .orElseThrow();
    }

    @Test
    @DisplayName("keeps the session id and the access token unreadable for scripts")
    void writesHttpOnlyCookies() {
        MockHttpServletResponse response = response();
        AuthCookies cookies = cookies(true, "");

        cookies.writeSession(response, "session-1");
        cookies.writeAccessToken(response, new TokenSet("access-1", "refresh-1", "id-1", Instant.now().plusSeconds(300), null));

        String session = setCookie(response, AuthCookies.SESSION);
        assertThat(session).contains("HttpOnly", "Path=/", "SameSite=Lax", "Secure");
        assertThat(session).contains("UK_SESSION=session-1");
        String access = setCookie(response, AuthCookies.ACCESS_TOKEN);
        assertThat(access).contains("HttpOnly", "Secure").contains("UK_TOKEN=access-1");
        assertThat(access).doesNotContain("Domain=");
    }

    @Test
    @DisplayName("omits Secure for a plain HTTP deployment and marks a configured domain")
    void followsConfiguration() {
        MockHttpServletResponse response = response();
        AuthCookies cookies = cookies(false, "user-kit.local");

        cookies.writeSession(response, "session-1");

        String session = setCookie(response, AuthCookies.SESSION);
        assertThat(session).doesNotContain("Secure");
        assertThat(session).contains("Domain=user-kit.local");
    }

    @Test
    @DisplayName("expires the cookies of the browser when it logs out")
    void clearsCookies() {
        MockHttpServletResponse response = response();

        cookies(true, "").clear(response);

        for (String name : new String[] {AuthCookies.SESSION, AuthCookies.ACCESS_TOKEN, AuthCookies.DEV_TOKEN}) {
            assertThat(setCookie(response, name)).contains("Max-Age=0", "HttpOnly");
        }
    }

    @Test
    @DisplayName("reads a cookie of the request and ignores empty ones")
    void readsCookies() {
        AuthCookies cookies = cookies(true, "");
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(AuthCookies.SESSION, "session-1"), new Cookie(AuthCookies.ACCESS_TOKEN, ""));

        assertThat(cookies.read(request, AuthCookies.SESSION)).contains("session-1");
        assertThat(cookies.read(request, AuthCookies.ACCESS_TOKEN)).isEmpty();
        assertThat(cookies.read(new MockHttpServletRequest(), AuthCookies.SESSION)).isEqualTo(Optional.empty());
    }
}