package com.acme.usermark.adapters.in.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class RequestOriginTest {

    @Test
    @DisplayName("reads the browser origin from the headers of the proxy")
    void readsForwardedHeaders() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-Host", "app.example.local");
        request.setServerName("backend");
        request.setServerPort(8080);

        assertThat(RequestOrigin.of(request)).isEqualTo("https://app.example.local");
    }

    @Test
    @DisplayName("takes the browser entry of a proxy chain")
    void readsFirstEntryOfChain() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-Proto", "https, http");
        request.addHeader("X-Forwarded-Host", "app.example.local, internal");

        assertThat(RequestOrigin.of(request)).isEqualTo("https://app.example.local");
    }

    @Test
    @DisplayName("falls back to the host header nginx sets")
    void readsHostHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("Host", "user-kit.next.local");
        request.setScheme("http");

        assertThat(RequestOrigin.of(request)).isEqualTo("https://user-kit.next.local");
    }

    @Test
    @DisplayName("keeps the port of a development server")
    void keepsNonDefaultPort() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Host", "localhost:3000");
        request.setScheme("http");

        assertThat(RequestOrigin.of(request)).isEqualTo("http://localhost:3000");
    }

    @Test
    @DisplayName("normalizes the case of the host so the allowlist matches")
    void normalizesCase() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-Proto", "HTTPS");
        request.addHeader("X-Forwarded-Host", "App.Example.Local");

        assertThat(RequestOrigin.of(request)).isEqualTo("https://app.example.local");
    }

    @Test
    @DisplayName("answers with an empty origin when there is no request at all")
    void survivesMissingRequest() {
        assertThat(RequestOrigin.of(null)).isEmpty();
    }
}