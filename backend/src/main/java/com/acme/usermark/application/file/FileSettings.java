package com.acme.usermark.application.file;

/**
 * Limits of the file use cases. The values come from the configuration, the
 * domain never reads them itself.
 */
public record FileSettings(long maxSizeBytes) {}
