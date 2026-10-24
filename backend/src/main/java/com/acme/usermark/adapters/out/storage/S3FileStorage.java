package com.acme.usermark.adapters.out.storage;

import com.acme.usermark.config.AppProperties;
import com.acme.usermark.domain.file.FileStorage;
import com.acme.usermark.domain.shared.DomainException;
import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Adapter of the object storage: a thin wrapper around the S3 API so that Silo,
 * AWS S3, Ceph or Garage behave identically.
 */
@Component
public class S3FileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(S3FileStorage.class);
    private static final int BUCKET_ATTEMPTS = 10;
    private static final Duration BUCKET_RETRY_DELAY = Duration.ofSeconds(2);
    private static final int BUCKET_ALREADY_EXISTS = 409;

    private final S3Client s3;
    private final AppProperties.Storage storage;

    public S3FileStorage(S3Client s3, AppProperties properties) {
        this.s3 = s3;
        this.storage = properties.storage();
    }

    @PostConstruct
    void ensureBucket() {
        if (!storage.createBucket()) {
            return;
        }
        // The object storage is started in parallel, so checking and creating the
        // bucket both retry and the order of the containers does not matter.
        for (int attempt = 1; attempt <= BUCKET_ATTEMPTS; attempt++) {
            if (bucketExists()) {
                return;
            }
            if (createBucket()) {
                return;
            }
            log.warn(
                    "Bucket {} is not available yet (attempt {}/{}), retrying",
                    storage.bucket(),
                    attempt,
                    BUCKET_ATTEMPTS);
            sleep();
        }
        log.warn("Bucket {} is still unavailable, uploads fail until the storage is reachable", storage.bucket());
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        try {
            s3.putObject(
                    PutObjectRequest.builder()
                            .bucket(storage.bucket())
                            .key(key)
                            .contentType(contentType)
                            .contentLength((long) content.length)
                            .build(),
                    RequestBody.fromBytes(content));
        } catch (RuntimeException exception) {
            throw DomainException.upstream(
                    "storage_unavailable", "The file storage rejected the upload: " + message(exception));
        }
    }

    @Override
    public InputStream get(String key) {
        try {
            return s3.getObject(GetObjectRequest.builder()
                    .bucket(storage.bucket())
                    .key(key)
                    .build());
        } catch (RuntimeException exception) {
            if (exception instanceof S3Exception s3Exception && s3Exception.statusCode() == 404) {
                throw DomainException.notFound("The stored content no longer exists");
            }
            throw DomainException.upstream(
                    "storage_unavailable", "The file storage is not available: " + message(exception));
        }
    }

    @Override
    public void delete(String key) {
        try {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(storage.bucket()).key(key).build());
        } catch (RuntimeException exception) {
            log.warn("Could not delete {} from the bucket: {}", key, message(exception));
        }
    }

    private boolean bucketExists() {
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(storage.bucket()).build());
            return true;
        } catch (RuntimeException exception) {
            log.debug("Bucket {} is not reachable yet: {}", storage.bucket(), message(exception));
            return false;
        }
    }

    private boolean createBucket() {
        try {
            s3.createBucket(CreateBucketRequest.builder().bucket(storage.bucket()).build());
            log.info("Bucket {} created", storage.bucket());
            return true;
        } catch (S3Exception exception) {
            if (exception.statusCode() == BUCKET_ALREADY_EXISTS) {
                log.info("Bucket {} exists already", storage.bucket());
                return true;
            }
            log.warn("Bucket {} could not be created: {}", storage.bucket(), message(exception));
            return false;
        } catch (RuntimeException exception) {
            log.warn("Bucket {} could not be created: {}", storage.bucket(), message(exception));
            return false;
        }
    }

    private void sleep() {
        try {
            Thread.sleep(BUCKET_RETRY_DELAY.toMillis());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private String message(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null ? exception.getClass().getSimpleName() : message;
    }
}
