package com.acme.usermark.domain.shared;

/** Optimistic concurrency support for the `If-Match` ETag headers. */
public final class Etag {

    private Etag() {
    }

    public static String of(long version) {
        return "W/\"" + version + "\"";
    }

    public static void verify(String ifMatch, long currentVersion) {
        if (ifMatch == null || ifMatch.isBlank() || "*".equals(ifMatch.trim())) {
            return;
        }
        String expected = of(currentVersion);
        for (String candidate : ifMatch.split(",")) {
            String trimmed = candidate.trim();
            if (trimmed.equals(expected) || trimmed.replace("W/", "").equals(expected.replace("W/", ""))) {
                return;
            }
        }
        throw DomainException.preconditionFailed(
                "The resource has been modified by someone else, reload and try again");
    }
}
