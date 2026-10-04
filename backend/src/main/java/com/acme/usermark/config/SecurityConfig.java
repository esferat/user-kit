package com.acme.usermark.config;

import com.acme.usermark.security.OidcJwtAuthenticationConverter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final AppProperties properties;

    public SecurityConfig(AppProperties properties) {
        this.properties = properties;
    }

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http, OidcJwtAuthenticationConverter jwtConverter, JwtDecoder jwtDecoder) throws Exception {
        return http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/health/**",
                                "/actuator/info",
                                "/v3/api-docs",
                                "/v3/api-docs/**",
                                "/swagger-ui.html",
                                "/swagger-ui/**",
                                "/api/v1/dev/**")
                        .permitAll()
                        .requestMatchers("/api/v1/admin/**", "/odata/Users", "/odata/Users/**")
                        .hasRole("ADMIN")
                        .anyRequest()
                        .authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.decoder(jwtDecoder).jwtAuthenticationConverter(jwtConverter))
                        .authenticationEntryPoint(SecurityConfig::writeUnauthorized)
                        .accessDeniedHandler(SecurityConfig::writeForbidden))
                .build();
    }

    /**
     * Cross origin access stays disabled while {@code app.security.cors.allowed-origins}
     * is empty, which is the case for the nginx deployment where frontend and API
     * share one origin.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        AppProperties.Cors cors = properties.cors();
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(cors.origins());
        configuration.setAllowedHeaders(cors.headers());
        configuration.setExposedHeaders(cors.exposed());
        configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowCredentials(!cors.origins().contains("*"));
        configuration.setMaxAge(cors.maxAge());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private static void writeUnauthorized(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException {
        writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "unauthorized", "Authentication is required");
    }

    private static void writeForbidden(HttpServletRequest request, HttpServletResponse response, AccessDeniedException exception)
            throws IOException {
        writeError(response, HttpServletResponse.SC_FORBIDDEN, "forbidden", "Access is denied");
    }

    private static void writeError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":\"%s\",\"message\":\"%s\",\"violations\":[]}".formatted(code, message));
    }
}
