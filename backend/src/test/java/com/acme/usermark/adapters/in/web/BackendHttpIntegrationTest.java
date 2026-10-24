package com.acme.usermark.adapters.in.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.acme.usermark.domain.file.FileStorage;
import com.jayway.jsonpath.JsonPath;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * HTTP level checks of the behaviour that unit tests cannot see: the local
 * account is resolved on every request, an administrator cannot keep the admin
 * API after a local role change, and file responses keep their headers.
 *
 * <p>The database is H2 in PostgreSQL mode, so the suite runs without Docker.
 * The SQL of the adapters is standard JPQL; the production stack still runs the
 * Flyway migrations against PostgreSQL.
 */
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:userkit;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;"
                    + "DEFAULT_NULL_ORDERING=HIGH;NON_KEYWORDS=ROLE,USER;DB_CLOSE_DELAY=-1",
            "spring.datasource.driver-class-name=org.h2.Driver",
            "spring.datasource.username=sa",
            "spring.datasource.password=",
            "spring.flyway.enabled=false",
            "spring.jpa.hibernate.ddl-auto=create-drop",
            "spring.jpa.open-in-view=false",
            "app.security.oidc.enabled=false",
            "app.security.oauth.enabled=false",
            "app.security.dev.enabled=true",
            "app.demo-data.enabled=false",
            "app.storage.create-bucket=false"
        })
@AutoConfigureMockMvc
class BackendHttpIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private FileStorage storage;

    @Test
    @DisplayName("the admin role is removed by the local account, not by the token")
    void localRoleChangeClosesTheAdminApi() throws Exception {
        String token = devToken("admin", "it-revoke@example.com");

        String list = mvc.perform(get("/api/v1/users")
                        .param("search", "it-revoke@example.com")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(list, "$.items[0].id");

        mvc.perform(patch("/api/v1/users/{id}", id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"user\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[0]").value("user"));

        mvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    @DisplayName("a disabled local account loses access although its token is still valid")
    void disabledAccountIsRefused() throws Exception {
        String token = devToken("admin", "it-disabled@example.com");

        String list = mvc.perform(get("/api/v1/users")
                        .param("search", "it-disabled@example.com")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(list, "$.items[0].id");

        mvc.perform(patch("/api/v1/users/{id}", id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    @DisplayName("the user list is filtered, sorted and paged in the database")
    void usersArePagedInTheDatabase() throws Exception {
        String admin = devToken("admin", "it-page-admin@example.com");
        for (int index = 1; index <= 3; index++) {
            String user = devToken("user", "it-page-user-" + index + "@example.com");
            mvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + user))
                    .andExpect(status().isOk());
        }

        mvc.perform(get("/api/v1/users")
                        .param("search", "it-page-user-")
                        .param("sort", "email")
                        .param("page", "1")
                        .param("size", "2")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].email").value("it-page-user-3@example.com"));
    }

    @Test
    @DisplayName("files are paged, downloaded and keep their ETag after a no-op patch")
    void filesKeepTheirApiContract() throws Exception {
        String token = devToken("user", "it-files@example.com");
        when(storage.get(anyString()))
                .thenAnswer(invocation -> new ByteArrayInputStream("hello".getBytes(StandardCharsets.UTF_8)));

        String first = upload(token, "first.txt", "text/plain", "hello");
        String second = upload(token, "second.txt", "text/plain", "hello");
        upload(token, "third.txt", "text/plain", "hello");

        mvc.perform(get("/api/v1/files")
                        .param("page", "1")
                        .param("size", "2")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.items.length()").value(1));

        mvc.perform(get("/api/v1/files")
                        .param("search", "second")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].name").value("second.txt"));

        String id = JsonPath.read(first, "$.id");
        String etag = JsonPath.read(first, "$.etag");
        assertThat(second).isNotBlank();

        mvc.perform(get("/api/v1/files/{id}/content", id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("ETag", etag))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("first.txt")))
                .andExpect(content().bytes("hello".getBytes(StandardCharsets.UTF_8)));

        jdbc.update(
                "update file_object set content_type = ? where id = ?",
                "not a media type",
                UUID.fromString(id));
        mvc.perform(get("/api/v1/files/{id}/content", id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", MediaType.APPLICATION_OCTET_STREAM_VALUE))
                .andExpect(content().bytes("hello".getBytes(StandardCharsets.UTF_8)));

        mvc.perform(patch("/api/v1/files/{id}", id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.etag").value(etag));

        mvc.perform(patch("/api/v1/files/{id}", id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.etag").value(etag));

        mvc.perform(patch("/api/v1/files/{id}", id)
                        .header("Authorization", "Bearer " + token)
                        .header("If-Match", "W/\"999\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"renamed.txt\"}"))
                .andExpect(status().isPreconditionFailed())
                .andExpect(jsonPath("$.code").value("precondition_failed"));
    }

    @Test
    @DisplayName("an upload with a malformed content type is a 400")
    void malformedContentTypeIsRejected() throws Exception {
        String token = devToken("user", "it-bad-type@example.com");
        MockMultipartFile file =
                new MockMultipartFile("file", "notes.txt", "not a media type", "hello".getBytes(StandardCharsets.UTF_8));

        mvc.perform(multipart("/api/v1/files")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_content_type"));
    }

    private String devToken(String role, String subject) throws Exception {
        String body = mvc.perform(get("/api/v1/dev/token").param("role", role).param("subject", subject))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.accessToken");
    }

    private String upload(String token, String name, String contentType, String content) throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("file", name, contentType, content.getBytes(StandardCharsets.UTF_8));
        return mvc.perform(multipart("/api/v1/files")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }
}
