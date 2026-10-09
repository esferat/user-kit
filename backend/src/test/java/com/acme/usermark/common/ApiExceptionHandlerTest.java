package com.acme.usermark.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.web.MockHttpServletRequest;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void unknownRequestPropertyIsReportedWithoutJacksonInternals() {
        var thrown = assertThatThrownBy(() -> mapper.readValue("{\"value\":\"kept\",\"typo\":1}", Payload.class))
                .isInstanceOf(UnrecognizedPropertyException.class)
                .asInstanceOf(
                        org.assertj.core.api.InstanceOfAssertFactories.type(UnrecognizedPropertyException.class));

        ResponseEntity<ApiError> response =
                handler.handleBadRequest(new HttpMessageNotReadableException("wrapped", thrown.actual()), request());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("bad_request");
        assertThat(response.getBody().message()).isEqualTo("Unknown request property: typo");
        assertThat(response.getBody().message()).doesNotContain("com.fasterxml");
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

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/v1/files/1");
        request.setRequestURI("/api/v1/files/1");
        return request;
    }

    private record Payload(String value) {
    }
}
