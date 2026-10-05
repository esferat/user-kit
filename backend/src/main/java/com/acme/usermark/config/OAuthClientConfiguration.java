package com.acme.usermark.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.web.client.RestClient;

/**
 * Client registration of the backend for frontend flow. The endpoints of the
 * identity provider come from its discovery document, so any OpenID Connect
 * provider works, not only Keycloak. The client is confidential: only the backend
 * knows the secret, which is why the browser receives cookies instead of tokens.
 *
 * <p>The registration is assembled from the document field by field instead of
 * through {@code ClientRegistrations}, because that helper rejects a document
 * whose {@code issuer} differs from the URL it was fetched from. The split setup
 * of the compose stack needs exactly that: the provider answers on the container
 * network while the tokens still carry the external issuer.
 */
@Configuration
@ConditionalOnProperty(prefix = "app.security.oauth", name = "enabled", havingValue = "true")
public class OAuthClientConfiguration {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String REGISTRATION_ID = "user-kit";

    /**
     * Endpoints the backend itself calls. The authorization and end session URLs
     * are deliberately absent: the browser visits them, and the browser only knows
     * the public host.
     */
    private static final List<String> SERVER_ENDPOINTS =
            List.of("token_endpoint", "revocation_endpoint", "introspection_endpoint", "userinfo_endpoint");

    @Bean
    ClientRegistration oidcClientRegistration(AppProperties properties, RestClient.Builder restClient) {
        AppProperties.Oidc oidc = properties.security().oidc();
        AppProperties.OAuth oauth = properties.security().oauth();
        if (!oidc.usable()) {
            throw new IllegalStateException(
                    "app.security.oidc.issuer-uri (OIDC_ISSUER_URI) must be set when the OAuth login is enabled");
        }
        if (!oauth.usable()) {
            throw new IllegalStateException(
                    "app.security.oauth.client-id (OIDC_CLIENT_ID) and client-secret (OIDC_CLIENT_SECRET) must be set "
                            + "when the OAuth login is enabled");
        }
        Map<String, Object> metadata = discovery(oidc.issuerUri(), oauth.issuerUri(), restClient);
        String issuer = required(metadata, "issuer", oauth.issuerUri());
        return ClientRegistration.withRegistrationId(REGISTRATION_ID)
                .clientId(oauth.clientId())
                .clientSecret(oauth.clientSecret())
                .clientName(oauth.clientId())
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(oauth.redirectUri())
                .scope(oauth.scopeList())
                .authorizationUri(required(metadata, "authorization_endpoint", issuer))
                .tokenUri(required(metadata, "token_endpoint", issuer))
                .jwkSetUri(required(metadata, "jwks_uri", issuer))
                .userInfoUri(required(metadata, "userinfo_endpoint", issuer))
                .userNameAttributeName("sub")
                .issuerUri(issuer)
                .providerConfigurationMetadata(metadata)
                .build();
    }

    /**
     * Reads the discovery document. When {@code OIDC_CLIENT_ISSUER_URI} points
     * somewhere else than the token issuer, the endpoint URLs are rewritten to
     * that URL: the backend must be able to reach the token endpoint, while
     * {@code issuer} keeps the value the tokens carry.
     */
    private Map<String, Object> discovery(String issuerUri, String discoveryIssuer, RestClient.Builder restClient) {
        JsonNode document = restClient
                .build()
                .get()
                .uri(discoveryIssuer + "/.well-known/openid-configuration")
                .retrieve()
                .body(JsonNode.class);
        if (document == null || document.path("token_endpoint").asText("").isBlank()) {
            throw new IllegalStateException("The identity provider published no discovery document at " + discoveryIssuer);
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        document.fields().forEachRemaining(entry -> metadata.put(entry.getKey(), MAPPER.convertValue(entry.getValue(), Object.class)));
        if (!discoveryIssuer.equals(issuerUri)) {
            SERVER_ENDPOINTS.forEach(key -> {
                Object value = metadata.get(key);
                if (value instanceof String url && url.startsWith(issuerUri)) {
                    metadata.put(key, discoveryIssuer + url.substring(issuerUri.length()));
                }
            });
        }
        return metadata;
    }

    private String required(Map<String, Object> metadata, String key, String issuerUri) {
        Object value = metadata.get(key);
        if (value == null || value.toString().isBlank()) {
            throw new IllegalStateException("The discovery document of " + issuerUri + " contains no " + key);
        }
        return value.toString();
    }
}