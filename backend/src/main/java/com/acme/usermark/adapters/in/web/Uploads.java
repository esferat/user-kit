package com.acme.usermark.adapters.in.web;

import com.acme.usermark.application.file.UploadFileCommand;
import com.acme.usermark.domain.file.FileUpload;
import com.acme.usermark.domain.shared.DomainException;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.web.multipart.MultipartFile;

/**
 * Turns the multipart request of the web layer into the upload the application
 * layer understands. The use cases never handle a servlet type.
 */
public final class Uploads {

    private Uploads() {
    }

    /** The content of an upload, the limit is checked before the bytes are read. */
    public static FileUpload of(MultipartFile upload, long maxSizeBytes) {
        validate(upload, maxSizeBytes);
        return new FileUpload(upload.getOriginalFilename(), upload.getContentType(), read(upload));
    }

    /** The content of an upload as the command of the file use case. */
    public static UploadFileCommand command(MultipartFile upload, long maxSizeBytes, String description) {
        validate(upload, maxSizeBytes);
        return new UploadFileCommand(
                upload.getOriginalFilename(), upload.getContentType(), read(upload), description);
    }

    private static void validate(MultipartFile upload, long maxSizeBytes) {
        if (upload == null || upload.isEmpty()) {
            throw DomainException.validation("empty_file", "The uploaded file is empty");
        }
        if (upload.getSize() > maxSizeBytes) {
            throw DomainException.payloadTooLarge(
                    "The file is larger than the configured limit of " + maxSizeBytes + " bytes");
        }
    }

    private static byte[] read(MultipartFile upload) {
        try (InputStream stream = upload.getInputStream()) {
            return stream.readAllBytes();
        } catch (IOException exception) {
            throw DomainException.validation("unreadable_upload", "The uploaded file could not be read");
        }
    }
}
