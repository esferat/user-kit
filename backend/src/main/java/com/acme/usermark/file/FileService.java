package com.acme.usermark.file;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.user.EtagSupport;
import com.acme.usermark.user.UserAccount;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * File use cases. All methods take and return DTOs so that entity mapping always
 * happens inside a transaction and no lazy association leaks into a controller.
 */
@Service
public class FileService {

    private static final DateTimeFormatter KEY_DATE = DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);
    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";
    private static final int MAX_NAME_LENGTH = 512;

    private final FileObjectRepository repository;
    private final FileStorageService storage;
    private final AppProperties properties;

    public FileService(FileObjectRepository repository, FileStorageService storage, AppProperties properties) {
        this.repository = repository;
        this.storage = storage;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public List<FileResponse> listVisibleTo(UserAccount current) {
        List<FileObject> files = current.isAdmin()
                ? repository.findAllWithOwner()
                : repository.findAllByOwnerWithOwner(current.getId());
        return files.stream().map(FileResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public FileResponse get(UUID id, UserAccount current) {
        return FileResponse.from(requireVisible(id, current));
    }

    @Transactional(readOnly = true)
    public FileDownload download(UUID id, UserAccount current) {
        FileObject file = requireVisible(id, current);
        return new FileDownload(FileResponse.from(file), storage.get(file.getStorageKey()));
    }

    @Transactional
    public FileResponse upload(MultipartFile upload, String description, UserAccount current) {
        if (upload == null || upload.isEmpty()) {
            throw ApiException.badRequest("empty_file", "The uploaded file is empty");
        }
        long maxSize = properties.files().maxSizeBytes();
        if (upload.getSize() > maxSize) {
            throw ApiException.payloadTooLarge("The file is larger than the configured limit of " + maxSize + " bytes");
        }

        String name = sanitizeName(upload.getOriginalFilename());
        String contentType = upload.getContentType() == null || upload.getContentType().isBlank()
                ? DEFAULT_CONTENT_TYPE
                : upload.getContentType();
        byte[] content = read(upload);

        UUID id = UUID.randomUUID();
        String key = "files/" + KEY_DATE.format(Instant.now()) + "/" + id + "/" + name;
        storage.put(key, content, contentType);

        try {
            FileObject file =
                    new FileObject(name, sanitizeDescription(description), contentType, content.length, sha256(content), key, current);
            return FileResponse.from(repository.saveAndFlush(file));
        } catch (RuntimeException exception) {
            storage.delete(key);
            throw exception;
        }
    }

    @Transactional
    public FileResponse update(UUID id, UserAccount current, String name, String description, String ifMatch) {
        FileObject file = requireVisible(id, current);
        EtagSupport.verify(ifMatch, file.getVersion());

        if (name != null) {
            file.setName(requireValidName(name));
        }
        if (description != null) {
            file.setDescription(sanitizeDescription(description));
        }
        file.touch();
        return FileResponse.from(repository.saveAndFlush(file));
    }

    @Transactional
    public void delete(UUID id, UserAccount current, String ifMatch) {
        FileObject file = requireVisible(id, current);
        EtagSupport.verify(ifMatch, file.getVersion());
        repository.delete(file);
        storage.delete(file.getStorageKey());
    }

    private FileObject requireVisible(UUID id, UserAccount current) {
        FileObject file = repository
                .findByIdWithOwner(id)
                .orElseThrow(() -> ApiException.notFound("File " + id + " does not exist"));
        if (!current.isAdmin() && !file.getOwner().getId().equals(current.getId())) {
            throw ApiException.forbidden("The file belongs to another user");
        }
        return file;
    }

    private byte[] read(MultipartFile upload) {
        try (InputStream stream = upload.getInputStream()) {
            return stream.readAllBytes();
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "unreadable_upload", "The uploaded file could not be read");
        }
    }

    private String sanitizeName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "file";
        }
        String name = originalName.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).trim();
        name = name.replaceAll("[\\p{Cntrl}]", "");
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            return "file";
        }
        return name.length() > MAX_NAME_LENGTH ? name.substring(0, MAX_NAME_LENGTH) : name;
    }

    private String requireValidName(String name) {
        String trimmed = name.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_NAME_LENGTH) {
            throw ApiException.badRequest("invalid_name", "name must contain 1 to " + MAX_NAME_LENGTH + " characters");
        }
        String sanitized = sanitizeName(trimmed);
        if (sanitized.equals("file") && !trimmed.equals("file")) {
            throw ApiException.badRequest("invalid_name", "name must not consist of path separators only");
        }
        return sanitized;
    }

    private String sanitizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        String trimmed = description.trim();
        return trimmed.length() > 2000 ? trimmed.substring(0, 2000) : trimmed;
    }

    private String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    public record FileDownload(FileResponse file, byte[] content) {
    }
}
