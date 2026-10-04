package com.acme.usermark.odata;

import com.acme.usermark.file.FileResponse;
import com.acme.usermark.user.UserAccount;
import com.acme.usermark.user.UserResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Maps API responses onto the flat JSON shape declared in $metadata. */
public final class ODataMappings {

    public static final Set<String> FILE_PROPERTIES =
            Set.of("id", "name", "description", "contentType", "sizeBytes", "ownerId", "ownerEmail", "createdAt", "updatedAt", "etag");
    public static final Set<String> USER_PROPERTIES =
            Set.of("id", "subject", "username", "email", "displayName", "roles", "enabled", "createdAt", "updatedAt", "etag");

    private ODataMappings() {
    }

    public static Map<String, Object> file(FileResponse file) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("@odata.id", "../odata/Files/" + file.id());
        row.put("@odata.etag", file.etag());
        row.put("id", file.id());
        row.put("name", file.name());
        row.put("description", file.description());
        row.put("contentType", file.contentType());
        row.put("sizeBytes", file.sizeBytes());
        row.put("ownerId", file.ownerId());
        row.put("ownerEmail", file.ownerEmail());
        row.put("createdAt", file.createdAt());
        row.put("updatedAt", file.updatedAt());
        row.put("etag", file.etag());
        return row;
    }

    public static Map<String, Object> user(UserAccount account) {
        return user(UserResponse.from(account));
    }

    public static Map<String, Object> user(UserResponse user) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("@odata.id", "../odata/Users/" + user.id());
        row.put("@odata.etag", user.etag());
        row.put("id", user.id());
        row.put("subject", user.subject());
        row.put("username", user.username());
        row.put("email", user.email());
        row.put("displayName", user.displayName());
        row.put("roles", user.roles());
        row.put("enabled", user.enabled());
        row.put("createdAt", user.createdAt());
        row.put("updatedAt", user.updatedAt());
        row.put("etag", user.etag());
        return row;
    }
}
