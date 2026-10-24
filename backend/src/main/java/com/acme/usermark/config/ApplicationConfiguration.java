package com.acme.usermark.config;

import com.acme.usermark.application.auth.OAuthSettings;
import com.acme.usermark.application.file.FileSettings;
import com.acme.usermark.application.shared.IdentitySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Wiring of the settings the use cases need. The configuration itself lives in
 * the environment, the application layer receives plain values it can use
 * without knowing where they came from.
 */
@Configuration
public class ApplicationConfiguration {

    @Bean
    FileSettings fileSettings(AppProperties properties) {
        return new FileSettings(properties.files().maxSizeBytes());
    }

    @Bean
    IdentitySettings identitySettings(AppProperties properties) {
        AppProperties.Oidc oidc = properties.security().oidc();
        return new IdentitySettings(oidc.rolesClaim(), oidc.audiences());
    }

    @Bean
    OAuthSettings oauthSettings(AppProperties properties) {
        AppProperties.OAuth oauth = properties.security().oauth();
        return new OAuthSettings(
                oauth.clientId(),
                oauth.redirectUri(),
                oauth.sessionTtl(),
                oauth.loginStateTtl(),
                oauth.redirectUriList(),
                oauth.postLogoutRedirectUriList());
    }

    /**
     * Small transactions around the database work of the login use case. The
     * identity provider is called outside of them, so an unavailable provider
     * never holds a connection of the pool.
     */
    @Bean
    TransactionOperations transactionOperations(PlatformTransactionManager manager) {
        return new TransactionTemplate(manager);
    }
}
