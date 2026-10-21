package com.acme.usermark.adapters.in.web.file;

import com.acme.usermark.adapters.in.security.CallerResolver;
import com.acme.usermark.adapters.in.web.ReadOnlyFields;
import com.acme.usermark.adapters.in.web.Uploads;
import com.acme.usermark.application.account.CallerContext;
import com.acme.usermark.application.account.CurrentAccountService;
import com.acme.usermark.application.file.FileDto;
import com.acme.usermark.application.file.FileSettings;
import com.acme.usermark.application.file.FileUseCases;
import com.acme.usermark.application.file.UpdateFileCommand;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.domain.shared.DomainException;
import com.acme.usermark.domain.shared.PageResult;
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

    private final FileUseCases files;
    private final CurrentAccountService accounts;
    private final CallerResolver callers;
    private final AppProperties properties;
    private final FileSettings settings;

    public FileController(
            FileUseCases files,
            CurrentAccountService accounts,
            CallerResolver callers,
            AppProperties properties,
            FileSettings settings) {
        this.files = files;
        this.accounts = accounts;
        this.callers = callers;
        this.properties = properties;
        this.settings = settings;
    }

    @GetMapping
    @Operation(summary = "Lists the files visible to the caller")
    public PageResult<FileDto> list(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "-createdAt") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        List<FileDto> rows = files.listVisibleTo(caller()).stream()
                .filter(file -> matchesSearch(file, search))
                .sorted(fileSorter(sort))
                .toList();
        return PageResult.of(rows, page, cappedSize(size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Returns a single file")
    public FileDto get(@PathVariable UUID id) {
        return files.get(id, caller());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Uploads a file and stores its content in the object storage")
    public FileDto upload(
            @Parameter(description = "File content") MultipartFile file,
            @Parameter(description = "Optional description") @RequestParam(required = false) String description) {
        return files.upload(Uploads.command(file, settings.maxSizeBytes(), description), caller());
    }

    @GetMapping(path = "/{id}/content", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @Operation(summary = "Downloads the content of a file")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
        FileUseCases.Download download = files.download(id, caller());
        FileDto file = download.file();
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
    public FileDto patch(
            @PathVariable UUID id,
            @RequestBody(required = false) FilePatch patch,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        if (patch != null) {
            patch.rejectReadOnly();
        }
        return files.update(
                id,
                caller(),
                new UpdateFileCommand(
                        patch == null ? null : patch.name(),
                        patch == null ? null : patch.description(),
                        ifMatch));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deletes a file including its stored content")
    public void delete(@PathVariable UUID id, @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        files.delete(id, caller(), ifMatch);
    }

    /** The caller of the request, resolved from the access token. */
    private CallerContext caller() {
        return accounts.resolve(callers.current());
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
    static boolean matchesSearch(FileDto file, String search) {
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
    static Comparator<FileDto> fileSorter(String sort) {
        return switch (sort == null ? "" : sort.trim()) {
            case "", "-createdAt" -> Comparator.comparing(FileDto::createdAt).reversed();
            case "createdAt" -> Comparator.comparing(FileDto::createdAt);
            case "name" -> Comparator.comparing(FileDto::name, String.CASE_INSENSITIVE_ORDER);
            case "-name" -> Comparator.comparing(FileDto::name, String.CASE_INSENSITIVE_ORDER).reversed();
            case "sizeBytes" -> Comparator.comparingLong(FileDto::sizeBytes);
            case "-sizeBytes" -> Comparator.comparingLong(FileDto::sizeBytes).reversed();
            case "updatedAt" -> Comparator.comparing(FileDto::updatedAt);
            case "-updatedAt" -> Comparator.comparing(FileDto::updatedAt).reversed();
            case "ownerEmail" -> Comparator.comparing(
                    FileDto::ownerEmail, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "-ownerEmail" -> Comparator.comparing(
                            FileDto::ownerEmail, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                    .reversed();
            default -> throw DomainException.validation("invalid_sort", "Unknown sort property: " + sort);
        };
    }

    private int cappedSize(int size) {
        return Math.min(Math.max(size, 1), properties.rest().maxPageSize());
    }
}
