package com.acme.usermark.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequest;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.web.client.RestClient;

class OAuthClientConfigurationTest {

    private static final String PUBLIC_ISSUER = "https://user-kit.ui5.local/auth/realms/user-kit";
    private static final String INTERNAL_ISSUER = "http://keycloak:8080/realms/user-kit";

    private final AtomicReference<URI> requested = new AtomicReference<>();

    @Test
    @DisplayName("a single issuer keeps every endpoint of the discovery document")
    void singleIssuer() {
        ClientRegistration registration = register(PUBLIC_ISSUER, PUBLIC_ISSUER);

        assertThat(requested.get()).isEqualTo(URI.create(PUBLIC_ISSUER + "/.well-known/openid-configuration"));
        assertThat(registration.getProviderDetails().getIssuerUri()).isEqualTo(PUBLIC_ISSUER);
        assertThat(registration.getProviderDetails().getTokenUri())
                .isEqualTo(PUBLIC_ISSUER + "/protocol/openid-connect/token");
        assertThat(registration.getProviderDetails().getJwkSetUri())
                .isEqualTo(PUBLIC_ISSUER + "/protocol/openid-connect/certs");
        assertThat(registration.getProviderDetails().getAuthorizationUri())
                .isEqualTo(PUBLIC_ISSUER + "/protocol/openid-connect/auth");
    }

    @Test
    @DisplayName("a split issuer reads the document where the backend reaches the provider")
    void splitIssuerReadsTheReachableDocument() {
        register(PUBLIC_ISSUER, INTERNAL_ISSUER);

        assertThat(requested.get()).isEqualTo(URI.create(INTERNAL_ISSUER + "/.well-known/openid-configuration"));
    }

    @Test
    @DisplayName("a split issuer keeps the token issuer of the document")
    void splitIssuerKeepsTheTokenIssuer() {
        ClientRegistration registration = register(PUBLIC_ISSUER, INTERNAL_ISSUER);

        assertThat(registration.getProviderDetails().getIssuerUri()).isEqualTo(PUBLIC_ISSUER);
    }

    @Test
    @DisplayName("a split issuer points the endpoints the backend calls at the container network")
    void splitIssuerRewritesTheServerEndpoints() {
        ClientRegistration registration = register(PUBLIC_ISSUER, INTERNAL_ISSUER);

        assertThat(registration.getProviderDetails().getTokenUri())
                .isEqualTo(INTERNAL_ISSUER + "/protocol/openid-connect/token");
        assertThat(registration.getProviderDetails().getUserInfoEndpoint().getUri())
                .isEqualTo(INTERNAL_ISSUER + "/protocol/openid-connect/userinfo");
        assertThat(registration.getProviderDetails().getJwkSetUri())
                .isEqualTo(PUBLIC_ISSUER + "/protocol/openid-connect/certs");
    }

    @Test
    @DisplayName("a split issuer leaves the endpoints the browser visits on the public issuer")
    void splitIssuerKeepsTheBrowserEndpointsPublic() {
        ClientRegistration registration = register(PUBLIC_ISSUER, INTERNAL_ISSUER);

        assertThat(registration.getProviderDetails().getAuthorizationUri())
                .isEqualTo(PUBLIC_ISSUER + "/protocol/openid-connect/auth");
        assertThat(registration.getProviderDetails().getConfigurationMetadata())
                .containsEntry("end_session_endpoint", PUBLIC_ISSUER + "/protocol/openid-connect/logout");
    }

    @Test
    @DisplayName("the registration of the client is the backend callback")
    void registrationUsesTheBackendCallback() {
        ClientRegistration registration = register(PUBLIC_ISSUER, PUBLIC_ISSUER);

        assertThat(registration.getRedirectUri()).isEqualTo("https://user-kit.ui5.local/api/v1/auth/callback");
        assertThat(registration.getClientId()).isEqualTo("user-kit-bff");
        assertThat(registration.getScopes()).containsExactly("openid", "profile", "email");
    }

    @Test
    @DisplayName("a provider without a token endpoint is rejected")
    void discoveryWithoutTokenEndpoint() {
        assertThatThrownBy(() -> registerDocument("{\"issuer\": \"" + PUBLIC_ISSUER + "\"}", PUBLIC_ISSUER, INTERNAL_ISSUER))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no discovery document");
    }

    @Test
    @DisplayName("an OAuth login without an issuer is rejected before any request")
    void missingIssuer() {
        AppProperties properties = new AppProperties(null, null, null, null, null, null);

        assertThatThrownBy(() -> new OAuthClientConfiguration().oidcClientRegistration(properties, RestClient.builder()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("OIDC_ISSUER_URI");
        assertThat(requested.get()).isNull();
    }

    /** The issuer the tokens carry, and the URL the discovery document is read from. */
    private ClientRegistration register(String issuerUri, String discoveryIssuer) {
        String document =
                """
                {
                  "issuer": "%1$s",
                  "authorization_endpoint": "%1$s/protocol/openid-connect/auth",
                  "token_endpoint": "%1$s/protocol/openid-connect/token",
                  "jwks_uri": "%1$s/protocol/openid-connect/certs",
                  "userinfo_endpoint": "%1$s/protocol/openid-connect/userinfo",
                  "end_session_endpoint": "%1$s/protocol/openid-connect/logout"
                }
                """
                        .formatted(issuerUri);
        return registerDocument(document, issuerUri, discoveryIssuer);
    }

    private ClientRegistration registerDocument(String document, String issuerUri, String discoveryIssuer) {
        AppProperties properties = new AppProperties(
                new AppProperties.Security(
                        new AppProperties.Oidc(true, issuerUri, "", List.of(), "roles"),
                        null,
                        new AppProperties.OAuth(
                                true,
                                "user-kit-bff",
                                "secret",
                                discoveryIssuer,
                                "https://user-kit.ui5.local/api/v1/auth/callback",
                                "https://user-kit.ui5.local/",
                                "openid profile email",
                                Duration.ofMinutes(10),
                                Duration.ofHours(12),
                                Duration.ofSeconds(90),
                                true,
                                "",
                                "",
                                "")),
                null,
                null,
                null,
                null,
                null);
        RestClient.Builder builder = RestClient.builder().requestFactory(new DocumentFactory(document));
        return new OAuthClientConfiguration().oidcClientRegistration(properties, builder);
    }

    private final class DocumentFactory implements ClientHttpRequestFactory {

        private final byte[] document;

        private DocumentFactory(String document) {
            this.document = document.getBytes(StandardCharsets.UTF_8);
        }

        @Override
        public ClientHttpRequest createRequest(URI uri, HttpMethod httpMethod) {
            requested.set(uri);
            return new StubRequest();
        }

        private final class StubRequest implements ClientHttpRequest {

            @Override
            public HttpMethod getMethod() {
                return HttpMethod.GET;
            }

            @Override
            public URI getURI() {
                return URI.create("https://provider.invalid/");
            }

            @Override
            public HttpHeaders getHeaders() {
                return new HttpHeaders();
            }

            @Override
            public Map<String, Object> getAttributes() {
                return new HashMap<>();
            }

            @Override
            public OutputStream getBody() {
                return OutputStream.nullOutputStream();
            }

            @Override
            public ClientHttpResponse execute() {
                return new ClientHttpResponse() {

                    @Override
                    public HttpStatusCode getStatusCode() {
                        return HttpStatus.OK;
                    }

                    @Override
                    public String getStatusText() {
                        return "OK";
                    }

                    @Override
                    public void close() {}

                    @Override
                    public HttpHeaders getHeaders() {
                        HttpHeaders headers = new HttpHeaders();
                        headers.setContentType(MediaType.APPLICATION_JSON);
                        return headers;
                    }

                    @Override
                    public InputStream getBody() {
                        return new ByteArrayInputStream(document);
                    }
                };
            }
        }
    }
}