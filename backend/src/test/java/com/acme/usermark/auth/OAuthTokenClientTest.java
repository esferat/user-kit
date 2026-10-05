package com.acme.usermark.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class OAuthTokenClientTest {

    private static final String ISSUER = "https://idp.example.com/realms/main";
    private static final String REDIRECT_URI = "https://app.example.com/api/v1/auth/callback";
    private static final String POST_LOGOUT_URI = "https://app.example.com/";

    private MockRestServiceServer provider;
    private OAuthTokenClient client;

    @BeforeEach
    void setUp() {
        ClientRegistration registration = ClientRegistration.withRegistrationId("user-kit")
                .clientId("user-kit-bff")
                .clientSecret("s3cret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(REDIRECT_URI)
                .scope("openid", "profile")
                .authorizationUri(ISSUER + "/protocol/openid-connect/auth")
                .tokenUri(ISSUER + "/protocol/openid-connect/token")
                .userInfoUri(ISSUER + "/protocol/openid-connect/userinfo")
                .userNameAttributeName("sub")
                .jwkSetUri(ISSUER + "/protocol/openid-connect/certs")
                .issuerUri(ISSUER)
                .clientName("user-kit-bff")
                .providerConfigurationMetadata(Map.of(
                        "authorization_endpoint", ISSUER + "/protocol/openid-connect/auth",
                        "token_endpoint", ISSUER + "/protocol/openid-connect/token",
                        "revocation_endpoint", ISSUER + "/protocol/openid-connect/revoke",
                        "end_session_endpoint", ISSUER + "/protocol/openid-connect/logout"))
                .build();

        AppProperties properties = new AppProperties(
                new AppProperties.Security(
                        new AppProperties.Oidc(true, ISSUER, "", List.of("user-kit-api"), "roles"),
                        new AppProperties.Dev(false, "user-kit-dev", "", Duration.ofHours(1)),
                        new AppProperties.OAuth(
                                true,
                                "user-kit-bff",
                                "s3cret",
                                ISSUER,
REDIRECT_URI,
                                POST_LOGOUT_URI,
                                "openid profile",
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

        RestClient.Builder builder = RestClient.builder();
        provider = MockRestServiceServer.bindTo(builder).build();
        client = new OAuthTokenClient(registration, builder, properties);
    }

@Test
    @DisplayName("builds the authorization URL with PKCE and every parameter")
    void buildsAuthorizationUrl() {
        String url = client.authorizationUrl("state-1", "challenge-1", REDIRECT_URI);

        assertThat(url).startsWith(ISSUER + "/protocol/openid-connect/auth?");
        assertThat(url).contains("response_type=code", "client_id=user-kit-bff", "state=state-1");
        assertThat(url).contains("scope=openid%20profile", "code_challenge=challenge-1", "code_challenge_method=S256");
        assertThat(url).contains("redirect_uri=https://app.example.com/api/v1/auth/callback");
        assertThat(url).doesNotContain(" ");
    }

    @Test
    @DisplayName("sends the callback of the frontend that started the login, not the one of the first domain")
    void usesCallbackOfTheLogin() {
        String second = "https://second.example.com/api/v1/auth/callback";

        String url = client.authorizationUrl("state-2", "challenge-2", second);

        assertThat(url).contains("redirect_uri=https://second.example.com/api/v1/auth/callback");
        assertThat(url).doesNotContain("app.example.com");
    }

    @Test
    @DisplayName("exchanges the code with the secret over HTTP basic")
    void exchangesCode() {
        provider.expect(requestTo(ISSUER + "/protocol/openid-connect/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", basic("user-kit-bff", "s3cret")))
                .andExpect(content().string(containsString("grant_type=authorization_code")))
                .andExpect(content().string(containsString("code=the-code")))
                .andExpect(content().string(containsString("code_verifier=the-verifier")))
                .andRespond(withSuccess(
                        """
                        {"access_token":"at-1","refresh_token":"rt-1","id_token":"it-1","expires_in":300}""",
                        MediaType.APPLICATION_JSON));

TokenSet tokens = client.exchangeCode("the-code", "the-verifier", REDIRECT_URI);

        assertThat(tokens.accessToken()).isEqualTo("at-1");
        assertThat(tokens.refreshToken()).isEqualTo("rt-1");
        assertThat(tokens.idToken()).isEqualTo("it-1");
        assertThat(tokens.expiresAt()).isAfter(java.time.Instant.now());
        assertThat(tokens.refreshTokenValid(java.time.Instant.now())).isTrue();
        provider.verify();
    }

    @Test
    @DisplayName("sends the same callback in the token request that the login announced")
    void exchangesCodeWithTheCallbackOfTheLogin() {
        String second = "https://second.example.com/api/v1/auth/callback";
        provider.expect(requestTo(ISSUER + "/protocol/openid-connect/token"))
                .andExpect(content().string(containsString("redirect_uri=https%3A%2F%2Fsecond.example.com%2Fapi%2Fv1%2Fauth%2Fcallback")))
                .andRespond(withSuccess(
                        """
                        {"access_token":"at-9","refresh_token":"rt-9","expires_in":300}""",
                        MediaType.APPLICATION_JSON));

        client.exchangeCode("the-code", "the-verifier", second);

        provider.verify();
    }

    @Test
    @DisplayName("refreshes a token with the refresh token grant")
    void refreshesToken() {
        provider.expect(requestTo(ISSUER + "/protocol/openid-connect/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("grant_type=refresh_token")))
                .andExpect(content().string(containsString("refresh_token=rt-1")))
                .andRespond(withSuccess(
                        """
                        {"access_token":"at-2","expires_in":60,"refresh_expires_in":1200}""",
                        MediaType.APPLICATION_JSON));

        TokenSet tokens = client.refresh("rt-1");

        assertThat(tokens.accessToken()).isEqualTo("at-2");
        assertThat(tokens.refreshExpiresAt()).isAfter(java.time.Instant.now());
        provider.verify();
    }

    @Test
    @DisplayName("reports a provider that answers without a token")
    void rejectsAnswerWithoutToken() {
        provider.expect(requestTo(ISSUER + "/protocol/openid-connect/token"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.exchangeCode("code", "verifier", REDIRECT_URI))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("did not return an access token");
        provider.verify();
    }

    @Test
    @DisplayName("revokes the refresh token of a logout")
    void revokesRefreshToken() {
        provider.expect(requestTo(ISSUER + "/protocol/openid-connect/revoke"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("token=rt-1")))
                .andExpect(content().string(containsString("token_type_hint=refresh_token")))
                .andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        client.revokeRefreshToken("rt-1");

        provider.verify();
    }

    @Test
    @DisplayName("never fails a logout when the provider has no revocation endpoint")
    void skipsRevocationWhenEndpointMissing() {
        AppProperties properties = new AppProperties(
                new AppProperties.Security(
                        new AppProperties.Oidc(false, "", "", List.of(), "roles"), null, null), null, null, null, null, null);
        ClientRegistration withoutRevocation = ClientRegistration.withRegistrationId("user-kit")
                .clientId("user-kit-bff")
                .clientSecret("s3cret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(REDIRECT_URI)
                .scope("openid")
                .authorizationUri(ISSUER + "/protocol/openid-connect/auth")
                .tokenUri(ISSUER + "/protocol/openid-connect/token")
                .userInfoUri(ISSUER + "/protocol/openid-connect/userinfo")
                .userNameAttributeName("sub")
                .jwkSetUri(ISSUER + "/protocol/openid-connect/certs")
                .issuerUri(ISSUER)
                .providerConfigurationMetadata(Map.of("token_endpoint", ISSUER + "/protocol/openid-connect/token"))
                .build();
        OAuthTokenClient limited = new OAuthTokenClient(withoutRevocation, RestClient.builder(), properties);

limited.revokeRefreshToken("rt-1");
        assertThat(limited.endSessionUrl("it-1", POST_LOGOUT_URI)).isEmpty();
    }

    @Test
    @DisplayName("builds the logout URL of the provider")
    void buildsEndSessionUrl() {
        String url = client.endSessionUrl("it-1", POST_LOGOUT_URI).orElseThrow();

        assertThat(url).startsWith(ISSUER + "/protocol/openid-connect/logout?");
        assertThat(url).contains("client_id=user-kit-bff", "id_token_hint=it-1");
        assertThat(url).contains("post_logout_redirect_uri=https://app.example.com/");
    }

    @Test
    @DisplayName("sends the visitor back to the frontend that asked for the logout")
    void usesPostLogoutUriOfTheRequest() {
        String url = client.endSessionUrl("it-1", "https://second.example.com/").orElseThrow();

        assertThat(url).contains("post_logout_redirect_uri=https://second.example.com/");
    }

    @Test
    @DisplayName("falls back to the configured post logout URI when the request has no known origin")
    void fallsBackToConfiguredPostLogoutUri() {
        String url = client.endSessionUrl("it-1", null).orElseThrow();

        assertThat(url).contains("post_logout_redirect_uri=https://app.example.com/");
    }

    private static String basic(String user, String password) {
        return "Basic "
                + Base64.getEncoder().encodeToString((user + ":" + password).getBytes(StandardCharsets.UTF_8));
    }
}