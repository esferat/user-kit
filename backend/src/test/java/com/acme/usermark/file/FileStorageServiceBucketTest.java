package com.acme.usermark.file;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.acme.usermark.config.AppProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.CreateBucketResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/** The bucket of the object storage is created on startup, Silo may need a moment for it. */
class FileStorageServiceBucketTest {

    private final S3Client s3 = mock(S3Client.class);

    private FileStorageService service(boolean createBucket) {
        AppProperties.Storage storage =
                new AppProperties.Storage("http://localhost:9000", "us-east-1", "user-kit", "siloadmin", "siloadmin", true, createBucket);
        return new FileStorageService(s3, new AppProperties(null, storage, null, null, null, null));
    }

    private AwsServiceException s3Error(int statusCode) {
        return S3Exception.builder().message("bucket error").statusCode(statusCode).build();
    }

    @Test
    @DisplayName("leaves an existing bucket alone")
    void keepsExistingBucket() {
        service(true).ensureBucket();

        verify(s3, times(1)).headBucket(any(HeadBucketRequest.class));
        verify(s3, never()).createBucket(any(CreateBucketRequest.class));
    }

    @Test
    @DisplayName("creates the bucket when it does not exist yet")
    void createsMissingBucket() {
        when(s3.headBucket(any(HeadBucketRequest.class))).thenThrow(s3Error(404));
        when(s3.createBucket(any(CreateBucketRequest.class))).thenReturn(CreateBucketResponse.builder().build());

        service(true).ensureBucket();

        verify(s3, times(1)).createBucket(any(CreateBucketRequest.class));
    }

    @Test
    @DisplayName("accepts a bucket that another instance created in the meantime")
    void acceptsAlreadyExistingBucket() {
        when(s3.headBucket(any(HeadBucketRequest.class))).thenThrow(s3Error(404));
        when(s3.createBucket(any(CreateBucketRequest.class))).thenThrow(s3Error(409));

        service(true).ensureBucket();

        verify(s3, times(1)).createBucket(any(CreateBucketRequest.class));
    }

    @Test
    @DisplayName("touches nothing when the bucket is managed outside the application")
    void skipsBucketManagement() {
        service(false).ensureBucket();

        verify(s3, never()).headBucket(any(HeadBucketRequest.class));
        verify(s3, never()).createBucket(any(CreateBucketRequest.class));
    }
}