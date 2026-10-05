package com.acme.usermark.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Security security, Storage storage, Files files, OData odata, Cors cors, DemoData demoData) {

    public AppProperties {
        security = security == null ? new Security(null, null, null) : security;
        storage = storage == null ? new Storage(null, null, null, null, null, false, false) : storage;
        files = files == null ? new Files(0) : files;
        odata = odata == null ? new OData(0, 0) : odata;
        cors = cors == null ? new Cors(null, null, null, null) : cors;
        demoData = demoData == null ? new DemoData(false) : demoData;
    }

    public record Security(Oidc oidc, Dev dev, OAuth oauth) {
        public Security {
            oidc = oidc == null ? new Oidc(false, "", "", List.of(), "roles") : oidc;
            dev = dev == null ? new Dev(false, "user-kit-dev", "", Duration.ofHours(1)) : dev;
            oauth = oauth == null
                    ? new OAuth(false, "", "", "", "", "", "", Duration.ofMinutes(10), Duration.ofHours(12), Duration.ofSeconds(90), true, "")
                    : oauth;
        }
    }

    public record Oidc(boolean enabled, String issuerUri, String jwkSetUri, List<String> audiences, String rolesClaim) {
        public Oidc {
            issuerUri = issuerUri == null ? "" : issuerUri;
            jwkSetUri = jwkSetUri == null ? "" : jwkSetUri;
            audiences = audiences == null ? List.of() : List.copyOf(audiences);
            rolesClaim = rolesClaim == null || rolesClaim.isBlank() ? "roles" : rolesClaim;
        }

        public boolean usable() {
            return enabled && !issuerUri.isBlank();
        }

        /** True when the keys must be fetched from a different URL than the issuer. */
        public boolean splitKeyLocation() {
            return usable() && !jwkSetUri.isBlank();
        }
    }

    public record Dev(boolean enabled, String issuer, String secret, Duration tokenTtl) {
        public Dev {
            issuer = issuer == null || issuer.isBlank() ? "user-kit-dev" : issuer;
            secret = secret == null ? "" : secret;
            tokenTtl = tokenTtl == null || tokenTtl.isNegative() || tokenTtl.isZero()
                    ? Duration.ofHours(1)
                    : tokenTtl;
        }
    }

    /**
     * Backend for frontend: the backend itself is the OAuth client and performs
     * the authorization code exchange, so the browser only receives httpOnly
     * cookies and the refresh token stays in the database.
     */
    public record OAuth(
            boolean enabled,
            String clientId,
            String clientSecret,
            String issuerUri,
            String redirectUri,
            String postLogoutRedirectUri,
            String scopes,
            Duration loginStateTtl,
            Duration sessionTtl,
            Duration refreshWindow,
            boolean cookieSecure,
            String cookieDomain) {

        public OAuth {
            clientId = clientId == null ? "" : clientId;
            clientSecret = clientSecret == null ? "" : clientSecret;
            issuerUri = issuerUri == null ? "" : issuerUri;
            redirectUri = redirectUri == null || redirectUri.isBlank() ? "https://user-kit.local/api/v1/auth/callback" : redirectUri;
            postLogoutRedirectUri =
                    postLogoutRedirectUri == null || postLogoutRedirectUri.isBlank() ? "https://user-kit.local/" : postLogoutRedirectUri;
            scopes = scopes == null || scopes.isBlank() ? "openid profile email" : scopes;
            loginStateTtl = positive(loginStateTtl, Duration.ofMinutes(10));
            sessionTtl = positive(sessionTtl, Duration.ofHours(12));
            refreshWindow = positive(refreshWindow, Duration.ofSeconds(90));
            cookieDomain = cookieDomain == null ? "" : cookieDomain;
        }

        public boolean usable() {
            return enabled && !clientId.isBlank() && !clientSecret.isBlank();
        }

        public List<String> scopeList() {
            return java.util.Arrays.stream(scopes.split("[\\s,]+"))
                    .map(String::trim)
                    .filter(entry -> !entry.isEmpty())
                    .toList();
        }

        private static Duration positive(Duration value, Duration fallback) {
            return value == null || value.isNegative() || value.isZero() ? fallback : value;
        }
    }

    public record Storage(
            String endpoint,
            String region,
            String bucket,
            String accessKey,
            String secretKey,
            boolean pathStyleAccess,
            boolean createBucket) {

        public Storage {
            endpoint = endpoint == null || endpoint.isBlank() ? "http://localhost:9000" : endpoint;
            region = region == null || region.isBlank() ? "us-east-1" : region;
            bucket = bucket == null || bucket.isBlank() ? "user-kit" : bucket;
            accessKey = accessKey == null ? "" : accessKey;
            secretKey = secretKey == null ? "" : secretKey;
        }
    }

    public record Files(long maxSizeBytes) {
        public Files {
            if (maxSizeBytes <= 0) {
                maxSizeBytes = 25L * 1024 * 1024;
            }
        }
    }

    /**
     * Sample documents for an empty store. Only read with the dev profile, so a
     * production deployment never receives demo data even when the flag is set.
     */
    public record DemoData(boolean enabled) {
    }

    public record OData(int defaultPageSize, int maxPageSize) {
        public OData {
            if (defaultPageSize <= 0) {
                defaultPageSize = 50;
            }
            if (maxPageSize <= 0) {
                maxPageSize = 200;
            }
        }
    }

    /**
     * Cross origin configuration for deployments where the browser does not use the
     * same origin as the API. Values are comma separated lists; an empty
     * allowedOrigins keeps the API same origin only.
     */
    public record Cors(String allowedOrigins, String allowedHeaders, String exposedHeaders, Duration maxAge) {

        public Cors {
            allowedOrigins = allowedOrigins == null ? "" : allowedOrigins;
            allowedHeaders = allowedHeaders == null ? "" : allowedHeaders;
            exposedHeaders = exposedHeaders == null ? "" : exposedHeaders;
            maxAge = maxAge == null || maxAge.isNegative() || maxAge.isZero() ? Duration.ofMinutes(30) : maxAge;
        }

        public List<String> origins() {
            return split(allowedOrigins);
        }

        public List<String> headers() {
            List<String> values = split(allowedHeaders);
            return values.isEmpty()
                    ? List.of("Authorization", "Content-Type", "If-Match", "Accept", "X-XSRF-TOKEN")
                    : values;
        }

        public List<String> exposed() {
            List<String> values = split(exposedHeaders);
            return values.isEmpty() ? List.of("ETag", "Location", "Content-Disposition") : values;
        }

        private static List<String> split(String value) {
            if (value == null || value.isBlank()) {
                return List.of();
            }
            return java.util.Arrays.stream(value.split(","))
                    .map(String::trim)
                    .filter(entry -> !entry.isEmpty())
                    .toList();
        }
    }
}
