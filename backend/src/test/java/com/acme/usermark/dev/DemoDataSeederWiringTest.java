package com.acme.usermark.dev;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.acme.usermark.file.FileObjectRepository;
import com.acme.usermark.file.FileService;
import com.acme.usermark.user.UserAccountRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * The seeder must never run outside the dev profile, not even when the property
 * is set: a deployment with a leftover configuration file would otherwise fill
 * an empty production store with sample documents.
 */
class DemoDataSeederWiringTest {

    private static final String DEV_PROFILE = "spring.profiles.active=dev";
    private static final String ENABLED = "app.demo-data.enabled=true";

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withBean(FileObjectRepository.class, () -> mock(FileObjectRepository.class))
            .withBean(UserAccountRepository.class, () -> mock(UserAccountRepository.class))
            .withBean(FileService.class, () -> mock(FileService.class))
            .withUserConfiguration(DemoDataSeeder.class);

    @Test
    @DisplayName("is active in the dev profile when the flag is set")
    void isActiveInDevProfile() {
        context.withPropertyValues(DEV_PROFILE, ENABLED)
                .run(runner -> assertThat(runner).hasSingleBean(DemoDataSeeder.class));
    }

    @Test
    @DisplayName("is inactive in the dev profile when the flag is missing")
    void isInactiveWithoutTheFlag() {
        context.withPropertyValues(DEV_PROFILE)
                .run(runner -> assertThat(runner).doesNotHaveBean(DemoDataSeeder.class));
    }

    @Test
    @DisplayName("is inactive outside the dev profile even with the flag set")
    void isInactiveOutsideDevProfile() {
        context.withPropertyValues(ENABLED)
                .run(runner -> assertThat(runner).doesNotHaveBean(DemoDataSeeder.class));
    }
}