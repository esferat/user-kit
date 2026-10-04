package com.acme.usermark.file;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/** Thin wrapper around the S3 API so that RustFS, MinIO and AWS S3 behave identically. */
@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private static final int BUCKET_ATTEMPTS = 10;
    private static final Duration BUCKET_RETRY_DELAY = Duration.ofSeconds(2);

    private final S3Client s3;
    private final AppProperties.Storage storage;

    public FileStorageService(S3Client s3, AppProperties properties) {
        this.s3 = s3;
        this.storage = properties.storage();
    }

    @PostConstruct
    void ensureBucket() {
        if (!storage.createBucket()) {
            return;
        }
        // The object storage is started in parallel, so a short retry loop avoids
        // depending on container start order.
        RuntimeException lastFailure = null;
        for (int attempt = 1; attempt <= BUCKET_ATTEMPTS; attempt++) {
            try {
                s3.headBucket(HeadBucketRequest.builder().bucket(storage.bucket()).build());
                return;
            } catch (S3Exception exception) {
                lastFailure = exception;
                log.info("Bucket {} does not exist yet, creating it", storage.bucket());
                break;
            } catch (RuntimeException exception) {
                lastFailure = exception;
                log.warn("Bucket {} is not reachable yet (attempt {}/{}): {}", storage.bucket(), attempt, BUCKET_ATTEMPTS, message(exception));
                sleep();
            }
        }

        try {
            s3.createBucket(CreateBucketRequest.builder().bucket(storage.bucket()).build());
            log.info("Bucket {} created", storage.bucket());
        } catch (RuntimeException exception) {
            log.warn("Bucket {} could not be created: {}", storage.bucket(), message(exception));
            if (lastFailure != null) {
                log.debug("The bucket check failed before with: {}", message(lastFailure));
            }
        }
    }

    private void sleep() {
        try {
            Thread.sleep(BUCKET_RETRY_DELAY.toMillis());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

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
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY, "storage_unavailable", "The file storage rejected the upload: " + message(exception));
        }
    }

    public byte[] get(String key) {
        try {
            return s3.getObjectAsBytes(GetObjectRequest.builder()
                            .bucket(storage.bucket())
                            .key(key)
                            .build())
                    .asByteArray();
        } catch (RuntimeException exception) {
            if (exception instanceof S3Exception s3Exception && s3Exception.statusCode() == 404) {
                throw ApiException.notFound("The stored content no longer exists");
            }
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY, "storage_unavailable", "The file storage is not available: " + message(exception));
        }
    }

    public void delete(String key) {
        try {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(storage.bucket()).key(key).build());
        } catch (RuntimeException exception) {
            log.warn("Could not delete {} from the bucket: {}", key, message(exception));
        }
    }

    private String message(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null ? exception.getClass().getSimpleName() : message;
    }
}
