package com.acme.usermark.file;

import com.acme.usermark.user.AuthenticatedUserService;
import com.acme.usermark.user.EtagSupport;
import com.acme.usermark.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Binary oriented endpoints. Metadata queries and single entity updates go
 * through the OData endpoints under /odata.
 */
@RestController
@RequestMapping(path = "/api/v1/files", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Files", description = "Upload, download and delete of file objects")
public class FileController {

    private final FileService fileService;
    private final AuthenticatedUserService userService;

    public FileController(FileService fileService, AuthenticatedUserService userService) {
        this.fileService = fileService;
        this.userService = userService;
    }

    @GetMapping
    @Operation(summary = "Lists the files visible to the caller")
    public FilePageResponse list(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        UserAccount current = userService.currentUser();
        List<FileResponse> all = fileService.listVisibleTo(current);
        int pageSize = Math.max(size, 1);
        int from = Math.min(Math.max(page, 0) * pageSize, all.size());
        int to = Math.min(from + pageSize, all.size());
        return new FilePageResponse(all.subList(from, to), all.size(), page, size);
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

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deletes a file including its stored content")
    public void delete(@PathVariable UUID id, @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        fileService.delete(id, userService.currentUser(), ifMatch);
    }

    public record FilePageResponse(List<FileResponse> items, long total, int page, int size) {
    }
}
