package com.acme.usermark.adapters.out.identity;

import com.acme.usermark.config.AppProperties;
import com.acme.usermark.domain.auth.IdentityProvider;
import com.acme.usermark.domain.auth.TokenSet;
import com.acme.usermark.domain.shared.DomainException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Adapter of the identity provider. It talks to the token, revocation and end
 * session endpoints of an OpenID Connect server. The client authenticates with
 * its secret over HTTP basic, which is why it never involves the browser.
 */
@Component
@ConditionalOnProperty(prefix = "app.security.oauth", name = "enabled", havingValue = "true")
public class OAuthIdentityProvider implements IdentityProvider {

    private static final String AUTHORIZATION_ENDPOINT = "authorization_endpoint";
    private static final String TOKEN_ENDPOINT = "token_endpoint";
    private static final String REVOCATION_ENDPOINT = "revocation_endpoint";
    private static final String END_SESSION_ENDPOINT = "end_session_endpoint";

    private final ClientRegistration registration;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String postLogoutRedirectUri;

    public OAuthIdentityProvider(
            ClientRegistration registration,
            RestClient.Builder restClient,
            AppProperties properties,
            ObjectMapper objectMapper) {
        this.registration = registration;
        this.restClient = restClient.build();
        this.objectMapper = objectMapper;
        this.postLogoutRedirectUri = properties.security().oauth().postLogoutRedirectUriList().get(0);
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    /**
     * Authorization URL for a started login. The callback is the one of the
     * frontend the visitor came from; without it the configured default is used,
     * which keeps a single frontend deployment working unchanged.
     */
    @Override
    public String authorizationUrl(String state, String codeChallenge, String callbackUri) {
        return endpoint(AUTHORIZATION_ENDPOINT, authorizationParameters(state, codeChallenge, callbackUri));
    }

    /**
     * Self registration page of the provider. Keycloak serves it next to the
     * authorization endpoint, so the same PKCE parameters are sent to
     * {@code /registrations} instead of {@code /auth} and the callback stays
     * the one of the login.
     */
    @Override
    public String registrationUrl(String state, String codeChallenge, String callbackUri) {
        String authorization = endpoint(AUTHORIZATION_ENDPOINT, Map.of());
        if (!authorization.endsWith("/auth")) {
            throw DomainException.upstream("The identity provider publishes no self registration endpoint");
        }
        String registration =
                authorization.substring(0, authorization.length() - "/auth".length()) + "/registrations";
        return withParameters(registration, authorizationParameters(state, codeChallenge, callbackUri));
    }

    private Map<String, String> authorizationParameters(String state, String codeChallenge, String callbackUri) {
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("response_type", "code");
        parameters.put("client_id", registration.getClientId());
        parameters.put(
                "redirect_uri",
                callbackUri == null || callbackUri.isBlank() ? registration.getRedirectUri() : callbackUri);
        parameters.put("scope", String.join(" ", registration.getScopes()));
        parameters.put("state", state);
        parameters.put("code_challenge", codeChallenge);
        parameters.put("code_challenge_method", "S256");
        return parameters;
    }

    /** Exchanges the code with the same callback the authorization request used. */
    @Override
    public TokenSet exchangeCode(String code, String codeVerifier, String callbackUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add(
                "redirect_uri",
                callbackUri == null || callbackUri.isBlank() ? registration.getRedirectUri() : callbackUri);
        form.add("code_verifier", codeVerifier);
        return tokenSet(postForm(endpoint(TOKEN_ENDPOINT, Map.of()), form, true));
    }

    @Override
    public TokenSet refresh(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", refreshToken);
        return tokenSet(postForm(endpoint(TOKEN_ENDPOINT, Map.of()), form, true));
    }

    /** Best effort revocation: the local session is dropped even when the provider is unreachable. */
    @Override
    public void revokeRefreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !hasEndpoint(REVOCATION_ENDPOINT)) {
            return;
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", refreshToken);
        form.add("token_type_hint", "refresh_token");
        try {
            postForm(endpoint(REVOCATION_ENDPOINT, Map.of()), form, true);
        } catch (DomainException exception) {
            // The token is worthless to us once the session row is gone.
        }
    }

    /** URL that ends the session of the provider itself, so the next login shows the form again. */
    @Override
    public Optional<String> endSessionUrl(String idToken, String redirectUri) {
        if (!hasEndpoint(END_SESSION_ENDPOINT)) {
            return Optional.empty();
        }
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("client_id", registration.getClientId());
        if (idToken != null && !idToken.isBlank()) {
            parameters.put("id_token_hint", idToken);
        }
        String target = redirectUri == null || redirectUri.isBlank() ? postLogoutRedirectUri : redirectUri;
        parameters.put("post_logout_redirect_uri", target);
        return Optional.of(endpoint(END_SESSION_ENDPOINT, parameters));
    }

    /**
     * Reads a claim of the access token without verifying it: it is only used to
     * label the session row.
     */
    @Override
    public String subjectOf(String accessToken) {
        try {
            String payload = new String(Base64.getUrlDecoder().decode(accessToken.split("\\.")[1]), StandardCharsets.UTF_8);
            JsonNode value = objectMapper.readTree(payload).get("sub");
            return value == null ? "unknown" : value.asText();
        } catch (RuntimeException exception) {
            return "unknown";
        }
    }

    private JsonNode postForm(String url, MultiValueMap<String, String> form, boolean authenticated) {
        RestClient.RequestBodySpec request = restClient.post().uri(url).contentType(MediaType.APPLICATION_FORM_URLENCODED);
        if (authenticated) {
            request.header(
                    HttpHeaders.AUTHORIZATION,
                    "Basic " + Base64.getEncoder()
                            .encodeToString((registration.getClientId() + ":" + registration.getClientSecret())
                                    .getBytes(StandardCharsets.UTF_8)));
        }
        JsonNode response = request.body(form).retrieve().body(JsonNode.class);
        return response == null ? null : response;
    }

    private TokenSet tokenSet(JsonNode response) {
        if (response == null || response.path("access_token").asText().isBlank()) {
            throw DomainException.upstream("The identity provider did not return an access token");
        }
        Instant now = Instant.now();
        return new TokenSet(
                response.path("access_token").asText(),
                text(response, "refresh_token"),
                text(response, "id_token"),
                now.plusSeconds(response.path("expires_in").asLong(300)),
                seconds(response, "refresh_expires_in", now));
    }

    private static Instant seconds(JsonNode response, String field, Instant now) {
        JsonNode value = response.get(field);
        return value == null || value.asLong() <= 0 ? null : now.plusSeconds(value.asLong());
    }

    private static String text(JsonNode response, String field) {
        JsonNode value = response.get(field);
        return value == null ? null : value.asText();
    }

    private boolean hasEndpoint(String name) {
        return registration.getProviderDetails().getConfigurationMetadata().containsKey(name);
    }

    private String endpoint(String name, Map<String, String> parameters) {
        Object value = registration.getProviderDetails().getConfigurationMetadata().get(name);
        String endpoint = value == null ? null : value.toString();
        if (endpoint == null || endpoint.isBlank()) {
            throw DomainException.upstream("The identity provider publishes no " + name);
        }
        return withParameters(endpoint, parameters);
    }

    private static String withParameters(String endpoint, Map<String, String> parameters) {
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(endpoint);
        for (Map.Entry<String, String> parameter : parameters.entrySet()) {
            uri.queryParam(parameter.getKey(), parameter.getValue());
        }
        return uri.build().encode().toUriString();
    }
}
