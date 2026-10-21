package com.acme.usermark.application.file;

/**
 * The request of an upload: the content of the file and its description. The
 * web adapter builds it from the multipart request, the use case never sees a
 * servlet type.
 */
public record UploadFileCommand(String name, String contentType, byte[] content, String description) {

    public UploadFileCommand {
        content = content == null ? new byte[0] : content.clone();
    }
}
