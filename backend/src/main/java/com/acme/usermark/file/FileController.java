package com.acme.usermark.file;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.common.PageResult;
import com.acme.usermark.common.ReadOnlyFields;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.user.AuthenticatedUserService;
import com.acme.usermark.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Classic REST JSON API of file objects, including the media stream of a file. */
@RestController
@RequestMapping(path = "/api/v1/files", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Files", description = "Upload, download, rename and delete of file objects")
public class FileController {

    private final FileService fileService;
    private final AuthenticatedUserService userService;
    private final AppProperties properties;

    public FileController(FileService fileService, AuthenticatedUserService userService, AppProperties properties) {
        this.fileService = fileService;
        this.userService = userService;
        this.properties = properties;
    }

    @GetMapping
    @Operation(summary = "Lists the files visible to the caller")
    public PageResult<FileResponse> list(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "-createdAt") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        UserAccount current = userService.currentUser();
        List<FileResponse> rows = fileService.listVisibleTo(current).stream()
                .filter(file -> matchesSearch(file, search))
                .sorted(fileSorter(sort))
                .toList();
        return PageResult.of(rows, page, cappedSize(size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Returns a single file")
    public FileResponse get(@PathVariable UUID id) {
        return fileService.get(id, userService.currentUser());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Uploads a file and stores its content in the object storage")
    public FileResponse upload(
            @Parameter(description = "File content") MultipartFile file,
            @Parameter(description = "Optional description") @RequestParam(required = false) String description) {
        return fileService.upload(file, description, userService.currentUser());
    }

    @GetMapping(path = "/{id}/content", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @Operation(summary = "Downloads the content of a file")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
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
    @Operation(summary = "Renames a file or changes its description")
    public FileResponse patch(
            @PathVariable UUID id,
            @RequestBody(required = false) FilePatch patch,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        if (patch != null) {
            patch.rejectReadOnly();
        }
        return fileService.update(
                id,
                userService.currentUser(),
                patch == null ? null : patch.name(),
                patch == null ? null : patch.description(),
                ifMatch);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deletes a file including its stored content")
    public void delete(@PathVariable UUID id, @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        fileService.delete(id, userService.currentUser(), ifMatch);
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
            String name,
            String description,
            String storageKey,
            String contentType,
            Long sizeBytes,
            String checksum,
            String ownerId,
            String createdAt,
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

    /** Подстрока из имени, описания или владельца, регистронезависимо. */
    static boolean matchesSearch(FileResponse file, String search) {
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        if (term.isEmpty()) {
            return true;
        }
        return containsIgnoreCase(file.name(), term)
                || containsIgnoreCase(file.description(), term)
                || containsIgnoreCase(file.ownerEmail(), term);
    }

    private static boolean containsIgnoreCase(String value, String term) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(term);
    }

    /** Сортировщик списка файлов; свойство с ведущим минусом — по убыванию. */
    static Comparator<FileResponse> fileSorter(String sort) {
        return switch (sort == null ? "" : sort.trim()) {
            case "", "-createdAt" -> Comparator.comparing(FileResponse::createdAt).reversed();
            case "createdAt" -> Comparator.comparing(FileResponse::createdAt);
            case "name" -> Comparator.comparing(FileResponse::name, String.CASE_INSENSITIVE_ORDER);
            case "-name" -> Comparator.comparing(FileResponse::name, String.CASE_INSENSITIVE_ORDER).reversed();
            case "sizeBytes" -> Comparator.comparingLong(FileResponse::sizeBytes);
            case "-sizeBytes" -> Comparator.comparingLong(FileResponse::sizeBytes).reversed();
            case "updatedAt" -> Comparator.comparing(FileResponse::updatedAt);
            case "-updatedAt" -> Comparator.comparing(FileResponse::updatedAt).reversed();
            case "ownerEmail" -> Comparator.comparing(
                    FileResponse::ownerEmail, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "-ownerEmail" -> Comparator.comparing(
                            FileResponse::ownerEmail, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                    .reversed();
            default -> throw ApiException.badRequest("invalid_sort", "Unknown sort property: " + sort);
        };
    }

    private int cappedSize(int size) {
        return Math.min(Math.max(size, 1), properties.rest().maxPageSize());
    }
}