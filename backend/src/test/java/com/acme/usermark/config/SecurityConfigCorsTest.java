package com.acme.usermark.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;

class SecurityConfigCorsTest {

    private CorsConfiguration configurationFor(AppProperties.Cors cors) {
        return (CorsConfiguration) new SecurityConfig(new AppProperties(null, null, null, null, cors))
                .corsConfigurationSource()
                .getCorsConfiguration(new MockHttpServletRequest("OPTIONS", "/api/v1/files"));
    }

    @Test
    @DisplayName("keeps the API same origin only by default")
    void disablesCrossOriginByDefault() {
        CorsConfiguration configuration = configurationFor(null);

        assertThat(configuration.getAllowedOrigins()).isEmpty();
        assertThat(configuration.getAllowedHeaders()).contains("Authorization", "If-Match");
        assertThat(configuration.getExposedHeaders()).contains("ETag");
        assertThat(configuration.getAllowedMethods()).containsExactly("GET", "POST", "PATCH", "DELETE", "OPTIONS");
    }

    @Test
    @DisplayName("parses a comma separated origin list")
    void parsesConfiguredOrigins() {
        AppProperties.Cors cors = new AppProperties.Cors("http://localhost:5173, https://app.example.com", null, null, null);

        assertThat(cors.origins()).containsExactly("http://localhost:5173", "https://app.example.com");
        assertThat(configurationFor(cors).getAllowedOrigins()).containsExactly("http://localhost:5173", "https://app.example.com");
    }

    @Test
    @DisplayName("keeps credentials out of wildcard configurations")
    void disablesCredentialsForWildcard() {
        CorsConfiguration configuration = configurationFor(new AppProperties.Cors("*", null, null, null));

        assertThat(configuration.getAllowCredentials()).isFalse();
    }
}
