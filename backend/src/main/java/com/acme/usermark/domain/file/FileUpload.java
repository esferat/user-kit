package com.acme.usermark.domain.file;

/**
 * The content of an upload, as the domain sees it. The web adapter turns a
 * multipart request into this value, so the use cases never handle a servlet
 * type.
 */
public record FileUpload(String name, String contentType, byte[] content) {

    public FileUpload {
        content = content == null ? new byte[0] : content.clone();
    }

    @Override
    public byte[] content() {
        return content;
    }
}
