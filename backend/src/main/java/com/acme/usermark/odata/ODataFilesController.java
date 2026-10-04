package com.acme.usermark.odata;

import com.acme.usermark.common.ReadOnlyFields;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.file.FileResponse;
import com.acme.usermark.file.FileService;
import com.acme.usermark.user.AuthenticatedUserService;
import com.acme.usermark.user.UserAccount;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** OData V4 subset for file objects, including the media stream of a file. */
@RestController
@RequestMapping(path = "/odata/Files")
public class ODataFilesController {

    private final FileService fileService;
    private final AuthenticatedUserService userService;
    private final AppProperties properties;

    public ODataFilesController(FileService fileService, AuthenticatedUserService userService, AppProperties properties) {
        this.fileService = fileService;
        this.userService = userService;
        this.properties = properties;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(HttpServletRequest request) {
        ODataQueryOptions options = ODataQueryOptions.from(
                request,
                ODataMappings.FILE_PROPERTIES,
                properties.odata().defaultPageSize(),
                properties.odata().maxPageSize());

        UserAccount current = userService.currentUser();
        List<Map<String, Object>> rows = fileService.listVisibleTo(current).stream()
                .map(ODataMappings::file)
                .toList();
        return ResponseEntity.ok(ODataResponses.collection("$metadata#Files", ODataQueryEngine.apply(rows, options)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ODataMappings.file(fileService.get(id, userService.currentUser())));
    }

    @GetMapping("/{id}/$value")
    public ResponseEntity<byte[]> value(@PathVariable UUID id) {
        FileService.FileDownload download = fileService.download(id, userService.currentUser());
        FileResponse file = download.file();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(download.content().length)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(file.name(), StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .header(HttpHeaders.ETAG, file.etag())
                .body(download.content());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Map<String, Object>> patch(
            @PathVariable UUID id,
            @RequestBody(required = false) FilePatch patch,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        if (patch != null) {
            patch.rejectReadOnly();
        }
        FileResponse file = fileService.update(
                id,
                userService.currentUser(),
                patch == null ? null : patch.name(),
                patch == null ? null : patch.description(),
                ifMatch);
        return ResponseEntity.ok(ODataMappings.file(file));
    }

    /**
     * Patch payload of a File. Read-only properties are part of the record on
     * purpose: they are deserialized so the request can be rejected with
     * {@code read_only_property} instead of being ignored, and unknown properties
     * are rejected by the globally strict Jackson configuration.
     */
    public record FilePatch(
            UUID id,
            String etag,
            String name, String description, String storageKey, String contentType, Long sizeBytes, String checksum, String ownerId, String createdAt,
            String updatedAt) {

        public void rejectReadOnly() {
            ReadOnlyFields.reject("Files", "id", id == null ? null : id.toString());
            ReadOnlyFields.reject("Files", "etag", etag);
            ReadOnlyFields.reject("Files", "storageKey", storageKey);
            ReadOnlyFields.reject("Files", "contentType", contentType);
            ReadOnlyFields.reject("Files", "sizeBytes", sizeBytes);
            ReadOnlyFields.reject("Files", "checksum", checksum);
            ReadOnlyFields.reject("Files", "ownerId", ownerId);
            ReadOnlyFields.reject("Files", "createdAt", createdAt);
            ReadOnlyFields.reject("Files", "updatedAt", updatedAt);
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id, @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        fileService.delete(id, userService.currentUser(), ifMatch);
        return ResponseEntity.noContent().build();
    }
}
