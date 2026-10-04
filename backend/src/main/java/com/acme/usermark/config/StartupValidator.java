package com.acme.usermark.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Fails fast when neither a real identity provider nor the dev token issuer is configured. */
@Component
public class StartupValidator implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StartupValidator.class);

    private final AppProperties properties;

    public StartupValidator(AppProperties properties) {
        this.properties = properties;
    }

    @Override
    public void run(ApplicationArguments args) {
        AppProperties.Security security = properties.security();
        if (security.dev().enabled()) {
            if (security.oidc().usable()) {
                log.warn(
                        "Both OIDC and dev authentication are enabled; tokens of both issuers are accepted. "
                                + "Set DEV_AUTH_ENABLED=false to run against the identity provider only");
            } else {
                log.warn("Dev authentication is enabled: tokens are issued by /api/v1/dev/token, never use this profile in production");
            }
            return;
        }
        if (!security.oidc().usable()) {
            throw new IllegalStateException(
                    "No token issuer configured. Set OIDC_ISSUER_URI (the issuer of the identity provider, "
                            + "for example https://user-kit.local/auth/realms/user-kit) or enable the dev profile");
        }
        AppProperties.Oidc oidc = security.oidc();
        if (oidc.splitKeyLocation()) {
            log.info("Accepting access tokens issued by {} (keys from {})", oidc.issuerUri(), oidc.jwkSetUri());
        } else {
            log.info("Accepting access tokens issued by {}", oidc.issuerUri());
        }
    }
}
