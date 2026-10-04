package com.acme.usermark.odata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acme.usermark.common.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

/**
 * Guards the patch contract: every read-only property of an entity is rejected
 * with {@code read_only_property}, writable properties are accepted and unknown
 * properties fail during deserialization because Jackson is configured with
 * {@code spring.jackson.deserialization.fail-on-unknown-properties=true}.
 */
class ODataPatchContractTest {

    private final ObjectMapper mapper = new ObjectMapper();

    static Stream<String> fileReadOnlyProperties() {
        return Stream.of(
                "\"id\":\"3f6a1c1e-6f2f-4a1b-9a1e-1b2c3d4e5f60\"",
                "\"etag\":\"W/\\\"3\\\"\"",
                "\"storageKey\":\"2026/10/04/uuid/report.pdf\"",
                "\"contentType\":\"application/pdf\"",
                "\"sizeBytes\":1024",
                "\"checksum\":\"9f2c\"",
                "\"ownerId\":\"3f6a1c1e-6f2f-4a1b-9a1e-1b2c3d4e5f60\"",
                "\"createdAt\":\"2026-10-04T10:00:00Z\"",
                "\"updatedAt\":\"2026-10-04T10:05:00Z\"");
    }

    static Stream<String> userReadOnlyProperties() {
        return Stream.of(
                "\"id\":\"3f6a1c1e-6f2f-4a1b-9a1e-1b2c3d4e5f60\"",
                "\"etag\":\"W/\\\"2\\\"\"",
                "\"subject\":\"auth0|abc\"",
                "\"username\":\"alice\"",
                "\"email\":\"alice@example.com\"",
                "\"displayName\":\"Alice\"",
                "\"createdAt\":\"2026-10-04T10:00:00Z\"",
                "\"updatedAt\":\"2026-10-04T10:05:00Z\"");
    }

    @ParameterizedTest
    @MethodSource("fileReadOnlyProperties")
    void filePatchRejectsReadOnlyProperty(String property) throws Exception {
        ODataFilesController.FilePatch patch = mapper.readValue("{" + property + "}", ODataFilesController.FilePatch.class);

        assertThatThrownBy(patch::rejectReadOnly)
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).code())
                .isEqualTo("read_only_property");
    }

    @ParameterizedTest
    @MethodSource("userReadOnlyProperties")
    void userPatchRejectsReadOnlyProperty(String property) throws Exception {
        ODataUsersController.UserPatch patch = mapper.readValue("{" + property + "}", ODataUsersController.UserPatch.class);

        assertThatThrownBy(patch::rejectReadOnly)
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).code())
                .isEqualTo("read_only_property");
    }

    @Test
    void filePatchAcceptsWritableProperties() throws Exception {
        ODataFilesController.FilePatch patch =
                mapper.readValue("{\"name\":\"report.pdf\",\"description\":\"Q3\"}", ODataFilesController.FilePatch.class);

        assertThatCode(patch::rejectReadOnly).doesNotThrowAnyException();
        assertThat(patch.name()).isEqualTo("report.pdf");
        assertThat(patch.description()).isEqualTo("Q3");
    }

    @Test
    void userPatchAcceptsWritableProperties() throws Exception {
        ODataUsersController.UserPatch patch =
                mapper.readValue("{\"roles\":[\"user\"],\"enabled\":false}", ODataUsersController.UserPatch.class);

        assertThatCode(patch::rejectReadOnly).doesNotThrowAnyException();
        assertThat(patch.roles()).containsExactly("user");
        assertThat(patch.enabled()).isFalse();
    }

    @Test
    void emptyPatchIsAccepted() throws Exception {
        assertThatCode(() -> mapper.readValue("{}", ODataFilesController.FilePatch.class).rejectReadOnly())
                .doesNotThrowAnyException();
        assertThatCode(() -> mapper.readValue("{}", ODataUsersController.UserPatch.class).rejectReadOnly())
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"ownerId\":\"x\"}", "{\"storageKey\":\"x\"}", "{\"nickname\":\"x\"}"})
    void unknownPropertyIsRejectedByStrictDeserialization(String json) {
        assertThatThrownBy(() -> mapper.readValue(json, ODataUsersController.UserPatch.class))
                .isInstanceOf(UnrecognizedPropertyException.class);
    }

    @Test
    void strictDeserializationIsEnabledForTheApplication() throws IOException {
        List<PropertySource<?>> sources =
                new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml"));

        Object value = sources.stream()
                .map(source -> source.getProperty("spring.jackson.deserialization.fail-on-unknown-properties"))
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        assertThat(value).isEqualTo(Boolean.TRUE);
    }
}
