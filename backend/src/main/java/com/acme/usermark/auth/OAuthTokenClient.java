package com.acme.usermark.auth;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Talks to the token, revocation and end session endpoints of the identity
 * provider. The client authenticates with its secret over HTTP basic, which is
 * why it never involves the browser.
 */
@Component
public class OAuthTokenClient {

    private static final String AUTHORIZATION_ENDPOINT = "authorization_endpoint";
    private static final String TOKEN_ENDPOINT = "token_endpoint";
    private static final String REVOCATION_ENDPOINT = "revocation_endpoint";
    private static final String END_SESSION_ENDPOINT = "end_session_endpoint";

    private final ClientRegistration registration;
    private final RestClient restClient;
    private final String postLogoutRedirectUri;

    public OAuthTokenClient(ClientRegistration registration, RestClient.Builder restClient, AppProperties properties) {
        this.registration = registration;
        this.restClient = restClient.build();
        this.postLogoutRedirectUri = properties.security().oauth().postLogoutRedirectUri();
    }

    public String authorizationUrl(String state, String codeChallenge) {
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("response_type", "code");
        parameters.put("client_id", registration.getClientId());
        parameters.put("redirect_uri", registration.getRedirectUri());
        parameters.put("scope", String.join(" ", registration.getScopes()));
        parameters.put("state", state);
        parameters.put("code_challenge", codeChallenge);
        parameters.put("code_challenge_method", "S256");
        return endpoint(AUTHORIZATION_ENDPOINT, parameters);
    }

    public TokenSet exchangeCode(String code, String codeVerifier) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", registration.getRedirectUri());
        form.add("code_verifier", codeVerifier);
        return tokenSet(postForm(endpoint(TOKEN_ENDPOINT, Map.of()), form, true));
    }

    public TokenSet refresh(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "refresh_token");
        form.add("refresh_token", refreshToken);
        return tokenSet(postForm(endpoint(TOKEN_ENDPOINT, Map.of()), form, true));
    }

    /** Best effort revocation: the local session is dropped even when the provider is unreachable. */
    public void revokeRefreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !hasEndpoint(REVOCATION_ENDPOINT)) {
            return;
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", refreshToken);
        form.add("token_type_hint", "refresh_token");
        try {
            postForm(endpoint(REVOCATION_ENDPOINT, Map.of()), form, true);
        } catch (ApiException exception) {
            // The token is worthless to us once the session row is gone.
        }
    }

    /** URL that ends the session of the provider itself, so the next login shows the form again. */
    public Optional<String> endSessionUrl(String idToken) {
        if (!hasEndpoint(END_SESSION_ENDPOINT)) {
            return Optional.empty();
        }
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("client_id", registration.getClientId());
        if (idToken != null && !idToken.isBlank()) {
            parameters.put("id_token_hint", idToken);
        }
        parameters.put("post_logout_redirect_uri", postLogoutRedirectUri());
        return Optional.of(endpoint(END_SESSION_ENDPOINT, parameters));
    }

    String postLogoutRedirectUri() {
        return postLogoutRedirectUri;
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
            throw ApiException.badGateway("The identity provider did not return an access token");
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
            throw ApiException.badGateway("The identity provider publishes no " + name);
        }
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(endpoint);
        for (Map.Entry<String, String> parameter : parameters.entrySet()) {
            uri.queryParam(parameter.getKey(), parameter.getValue());
        }
        return uri.build().encode().toUriString();
    }
}