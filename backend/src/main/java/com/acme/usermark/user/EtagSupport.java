package com.acme.usermark.user;

import com.acme.usermark.common.ApiException;
import org.springframework.http.HttpStatus;

/** Optimistic concurrency support for OData style `If-Match` headers. */
public final class EtagSupport {

    private EtagSupport() {
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
        throw new ApiException(
                HttpStatus.PRECONDITION_FAILED,
                "precondition_failed",
                "The resource has been modified by someone else, reload and try again");
    }
}
