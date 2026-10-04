package com.acme.usermark.config;

import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
public class S3ClientConfiguration {

    @Bean(destroyMethod = "close")
    S3Client s3Client(AppProperties properties) {
        AppProperties.Storage storage = properties.storage();
        S3Configuration serviceConfiguration = S3Configuration.builder()
                .pathStyleAccessEnabled(storage.pathStyleAccess())
                .chunkedEncodingEnabled(false)
                .build();

        var builder = S3Client.builder()
                .region(Region.of(storage.region()))
                .serviceConfiguration(serviceConfiguration);

        if (!storage.endpoint().isBlank() && !storage.endpoint().equals("https://s3.amazonaws.com")) {
            builder.endpointOverride(URI.create(storage.endpoint()));
        }
        if (!storage.accessKey().isBlank() && !storage.secretKey().isBlank()) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(storage.accessKey(), storage.secretKey())));
        }
        return builder.build();
    }
}
