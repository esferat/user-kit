package com.acme.usermark.application.file;

import com.acme.usermark.application.account.CallerContext;
import com.acme.usermark.domain.file.FileObject;
import com.acme.usermark.domain.file.FileRepository;
import com.acme.usermark.domain.file.FileStorage;
import com.acme.usermark.domain.shared.ContentTypes;
import com.acme.usermark.domain.shared.DomainException;
import com.acme.usermark.domain.shared.Etag;
import com.acme.usermark.domain.shared.PageQuery;
import com.acme.usermark.domain.shared.PageResult;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Use cases of the file objects. They take commands and the caller, and answer
 * with DTOs: the aggregates of the domain never leave this layer.
 */
@Component
public class FileUseCases {

    private static final DateTimeFormatter KEY_DATE = DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);
    private static final int MAX_NAME_LENGTH = 512;

    private final FileRepository files;
    private final FileStorage storage;
    private final long maxSizeBytes;

    public FileUseCases(FileRepository files, FileStorage storage, FileSettings settings) {
        this.files = files;
        this.storage = storage;
        this.maxSizeBytes = settings.maxSizeBytes();
    }

    @Transactional(readOnly = true)
    public PageResult<FileDto> listVisibleTo(CallerContext caller, String search, String sort, PageQuery page) {
        PageResult<FileObject> found = files.search(
                search, caller.admin() ? null : caller.id(), caller.admin(), sort, page);
        return PageResult.of(
                found.items().stream().map(FileDto::from).toList(),
                found.total(),
                found.page(),
                found.size());
    }

    @Transactional(readOnly = true)
    public FileDto get(UUID id, CallerContext caller) {
        return FileDto.from(requireVisible(id, caller));
    }

    @Transactional(readOnly = true)
    public Download download(UUID id, CallerContext caller) {
        FileObject file = requireVisible(id, caller);
        return new Download(FileDto.from(file), storage.get(file.storageKey()));
    }

    @Transactional
    public FileDto upload(UploadFileCommand command, CallerContext caller) {
        if (command == null || command.content().length == 0) {
            throw DomainException.validation("empty_file", "The uploaded file is empty");
        }
        byte[] content = command.content();
        if (content.length > maxSizeBytes) {
            throw DomainException.payloadTooLarge(
                    "The file is larger than the configured limit of " + maxSizeBytes + " bytes");
        }

        String name = sanitizeName(command.name());
        String contentType = ContentTypes.normalize(command.contentType());

        UUID id = UUID.randomUUID();
        String key = "files/" + KEY_DATE.format(Instant.now()) + "/" + id + "/" + name;
        storage.put(key, content, contentType);

        try {
            FileObject file = FileObject.create(
                    name,
                    sanitizeDescription(command.description()),
                    contentType,
                    content.length,
                    sha256(content),
                    key,
                    caller.id(),
                    caller.email());
            return FileDto.from(files.save(file));
        } catch (RuntimeException exception) {
            storage.delete(key);
            throw exception;
        }
    }

    @Transactional
    public FileDto update(UUID id, CallerContext caller, UpdateFileCommand command) {
        FileObject file = requireVisible(id, caller);
        Etag.verify(command.ifMatch(), file.version());

        boolean changed = false;
        if (command.name() != null) {
            file.rename(requireValidName(command.name()));
            changed = true;
        }
        if (command.description() != null) {
            file.describe(sanitizeDescription(command.description()));
            changed = true;
        }
        if (!changed) {
            return FileDto.from(file);
        }
        file.touch();
        return FileDto.from(files.save(file));
    }

    @Transactional
    public void delete(UUID id, CallerContext caller, String ifMatch) {
        FileObject file = requireVisible(id, caller);
        Etag.verify(ifMatch, file.version());
        files.delete(file);
        storage.delete(file.storageKey());
    }

    private FileObject requireVisible(UUID id, CallerContext caller) {
        FileObject file = files
                .findById(id)
                .orElseThrow(() -> DomainException.notFound("File " + id + " does not exist"));
        if (!caller.admin() && !file.ownerId().equals(caller.id())) {
            throw DomainException.forbidden("The file belongs to another user");
        }
        return file;
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
            throw DomainException.validation("invalid_name", "name must contain 1 to " + MAX_NAME_LENGTH + " characters");
        }
        String sanitized = sanitizeName(trimmed);
        if (sanitized.equals("file") && !trimmed.equals("file")) {
            throw DomainException.validation("invalid_name", "name must not consist of path separators only");
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

    /** A file and the stream of its content; the web adapter closes the stream. */
    public record Download(FileDto file, InputStream content) {}
}
