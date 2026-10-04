package com.acme.usermark.odata;

import com.acme.usermark.common.ReadOnlyFields;
import com.acme.usermark.config.AppProperties;
import com.acme.usermark.user.AuthenticatedUserService;
import com.acme.usermark.user.UserAccount;
import com.acme.usermark.user.UserAdminService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** OData V4 subset for user accounts; administrators only. */
@RestController
@RequestMapping(path = "/odata/Users")
public class ODataUsersController {

    private final AuthenticatedUserService userService;
    private final UserAdminService adminService;
    private final AppProperties properties;

    public ODataUsersController(
            AuthenticatedUserService userService, UserAdminService adminService, AppProperties properties) {
        this.userService = userService;
        this.adminService = adminService;
        this.properties = properties;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(HttpServletRequest request) {
        ODataQueryOptions options = ODataQueryOptions.from(
                request,
                ODataMappings.USER_PROPERTIES,
                properties.odata().defaultPageSize(),
                properties.odata().maxPageSize());

        userService.currentUser();
        List<Map<String, Object>> rows = adminService.findAll().stream().map(ODataMappings::user).toList();
        return ResponseEntity.ok(ODataResponses.collection("$metadata#Users", ODataQueryEngine.apply(rows, options)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable UUID id) {
        userService.currentUser();
        return ResponseEntity.ok(ODataMappings.user(userService.requireById(id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Map<String, Object>> patch(
            @PathVariable UUID id,
            @RequestBody(required = false) UserPatch patch,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        userService.currentUser();
        if (patch != null) {
            patch.rejectReadOnly();
        }
        List<String> roles = patch == null ? null : patch.roles();
        Boolean enabled = patch == null ? null : patch.enabled();
        UserAccount updated = adminService.update(id, roles, enabled, ifMatch);
        return ResponseEntity.ok(ODataMappings.user(updated));
    }

    /**
     * Patch payload of a User. Read-only properties are part of the record on
     * purpose: they are deserialized so the request can be rejected with
     * {@code read_only_property} instead of being ignored, and unknown properties
     * are rejected by the globally strict Jackson configuration.
     */
    public record UserPatch(
            UUID id,
            String etag,
            List<String> roles,
            Boolean enabled,
            String subject,
            String username,
            String email,
            String displayName,
            String createdAt,
            String updatedAt) {

        public void rejectReadOnly() {
            ReadOnlyFields.reject("Users", "id", id == null ? null : id.toString());
            ReadOnlyFields.reject("Users", "etag", etag);
            ReadOnlyFields.reject("Users", "subject", subject);
            ReadOnlyFields.reject("Users", "username", username);
            ReadOnlyFields.reject("Users", "email", email);
            ReadOnlyFields.reject("Users", "displayName", displayName);
            ReadOnlyFields.reject("Users", "createdAt", createdAt);
            ReadOnlyFields.reject("Users", "updatedAt", updatedAt);
        }
    }
}
