package com.acme.usermark.domain.shared;

import java.util.regex.Pattern;

/**
 * Validation and normalization of media types coming from the browser. The
 * value is stored and later used in a response header, so control characters
 * must never reach either place.
 */
public final class ContentTypes {

    public static final String DEFAULT = "application/octet-stream";

    private static final Pattern MEDIA_TYPE =
            Pattern.compile("^[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+(?:\\s*;.*)?$");

    private ContentTypes() {
    }

    /** The normalized media type, or the default when the caller did not send one. */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return DEFAULT;
        }
        String value = raw.trim();
        if (value.chars().anyMatch(character -> character < 0x20 || character == 0x7f)
                || !MEDIA_TYPE.matcher(value).matches()) {
            throw DomainException.validation("invalid_content_type", "The content type is not a valid media type");
        }
        return value;
    }
}
