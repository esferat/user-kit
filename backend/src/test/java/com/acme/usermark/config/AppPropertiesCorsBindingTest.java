package com.acme.usermark.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

/**
 * Binds the shipped configuration files instead of building {@link AppProperties}
 * by hand, so a property that no longer matches the record fails here. The CORS
 * block used to live under {@code app.security} and was therefore never bound,
 * which silently kept the API same origin only.
 */
class AppPropertiesCorsBindingTest {

    private final YamlPropertySourceLoader loader = new YamlPropertySourceLoader();

    @Test
    @DisplayName("keeps the API same origin only without the dev profile")
    void staysSameOriginOnlyByDefault() throws IOException {
        AppProperties properties = bind(environment(new StandardEnvironment()));

        assertThat(properties.cors().origins()).isEmpty();
        assertThat(properties.cors().headers()).contains("Authorization", "Content-Type", "If-Match");
        assertThat(properties.security().dev().enabled()).isFalse();
    }

    @Test
    @DisplayName("allows the Vite dev server origin in the dev profile")
    void allowsTheDevServerOrigin() throws IOException {
        AppProperties properties = bind(environment(new StandardEnvironment(), "dev"));

        assertThat(properties.security().dev().enabled()).isTrue();
        assertThat(properties.cors().origins()).containsExactly("http://localhost:5173");
    }

    @Test
    @DisplayName("takes the origin list from the environment when it is set")
    void environmentOverridesTheDevDefault() throws IOException {
        StandardEnvironment environment = environment(new StandardEnvironment(), "dev");
        environment.getPropertySources()
                .addFirst(new MapPropertySource("test", Map.of("CORS_ALLOWED_ORIGINS", "https://app.example.com")));

        assertThat(bind(environment).cors().origins()).containsExactly("https://app.example.com");
    }

    private AppProperties bind(StandardEnvironment environment) {
        return Binder.get(environment)
                .bind("app", AppProperties.class)
                .orElseThrow(() -> new IllegalStateException("the configuration files define no app properties"));
    }

    /**
     * Loads {@code application.yml} with the given profiles merged into it, the way
     * the Spring configuration data does it: profile values replace the base ones
     * instead of becoming a lower ranked property source.
     */
    private StandardEnvironment environment(StandardEnvironment environment, String... profiles) throws IOException {
        environment.setActiveProfiles(profiles);
        Map<String, Object> merged = new LinkedHashMap<>();
        merge(merged, "application");
        for (String profile : profiles) {
            merge(merged, "application-" + profile);
        }
        environment.getPropertySources().addLast(new MapPropertySource("applicationConfig", merged));
        return environment;
    }

    private void merge(Map<String, Object> target, String name) throws IOException {
        for (PropertySource<?> loaded : loader.load(name, new ClassPathResource(name + ".yml"))) {
            if (loaded instanceof EnumerablePropertySource<?> enumerable) {
                for (String key : enumerable.getPropertyNames()) {
                    target.put(key, enumerable.getProperty(key));
                }
            }
        }
    }
}
