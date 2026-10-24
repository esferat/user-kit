package com.acme.usermark.adapters.in.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.exc.UnrecognizedPropertyException;
import tools.jackson.databind.json.JsonMapper;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    @Test
    void unknownRequestPropertyIsReportedWithoutJacksonInternals() {
        var thrown = assertThatThrownBy(() -> mapper.readValue("{\"value\":\"kept\",\"typo\":1}", Payload.class))
                .isInstanceOf(UnrecognizedPropertyException.class)
                .asInstanceOf(
                        org.assertj.core.api.InstanceOfAssertFactories.type(UnrecognizedPropertyException.class));

        ResponseEntity<ApiError> response =
                handler.handleBadRequest(new HttpMessageNotReadableException("wrapped", thrown.actual(), null), request());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("bad_request");
        assertThat(response.getBody().message()).isEqualTo("Unknown request property: typo");
        assertThat(response.getBody().message()).doesNotContain("tools.jackson");
        assertThat(response.getBody().path()).isEqualTo("/api/v1/files/1");
        assertThat(response.getBody().violations()).isEmpty();
    }

    @Test
    void otherBadRequestsKeepTheirMessage() {
        ResponseEntity<ApiError> response = handler.handleBadRequest(new IllegalStateException("plain"), request());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().message()).isEqualTo("plain");
    }

    @Test
    void missingMultipartPartIsABadRequest() {
        ResponseEntity<ApiError> response =
                handler.handleBadRequest(new MissingServletRequestPartException("file"), request());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("bad_request");
    }

    @Test
    void concurrentModificationIsAConflict() {
        ResponseEntity<ApiError> response = handler.handleOptimisticLock(
                new ObjectOptimisticLockingFailureException(String.class, "id"), request());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("conflict");
    }

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/v1/files/1");
        request.setRequestURI("/api/v1/files/1");
        return request;
    }

    private record Payload(String value) {
    }
}
