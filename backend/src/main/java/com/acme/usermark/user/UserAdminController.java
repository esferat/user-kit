package com.acme.usermark.user;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.common.PageResult;
import com.acme.usermark.common.ReadOnlyFields;
import com.acme.usermark.config.AppProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Classic REST JSON API of user accounts; administrators only. */
@RestController
@RequestMapping(path = "/api/v1/users", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Users", description = "Administration of user accounts; requires the admin role")
public class UserAdminController {

    private final AuthenticatedUserService userService;
    private final UserAdminService adminService;
    private final AppProperties properties;

    public UserAdminController(
            AuthenticatedUserService userService, UserAdminService adminService, AppProperties properties) {
        this.userService = userService;
        this.adminService = adminService;
        this.properties = properties;
    }

    @GetMapping
    @Operation(summary = "Lists the user accounts of the backend")
    public PageResult<UserResponse> list(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "email") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        userService.currentUser();
        List<UserResponse> rows = adminService.findAll().stream()
                .map(UserResponse::from)
                .filter(user -> matchesSearch(user, search))
                .sorted(userSorter(sort))
                .toList();
        return PageResult.of(rows, page, cappedSize(size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Returns a single user account")
    public UserResponse get(@PathVariable UUID id) {
        userService.currentUser();
        return UserResponse.from(userService.requireById(id));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Assigns roles or changes the enabled flag")
    public UserResponse patch(
            @PathVariable UUID id,
            @RequestBody(required = false) UserPatch patch,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        userService.currentUser();
        if (patch != null) {
            patch.rejectReadOnly();
        }
        UserAccount updated =
                adminService.update(id, patch == null ? null : patch.roles(), patch == null ? null : patch.enabled(), ifMatch);
        return UserResponse.from(updated);
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

    /** Подстрока из email, имени для отображения или имени пользователя. */
    static boolean matchesSearch(UserResponse user, String search) {
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        if (term.isEmpty()) {
            return true;
        }
        return containsIgnoreCase(user.email(), term)
                || containsIgnoreCase(user.displayName(), term)
                || containsIgnoreCase(user.username(), term);
    }

    private static boolean containsIgnoreCase(String value, String term) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(term);
    }

    /** Сортировщик списка пользователей; свойство с ведущим минусом — по убыванию. */
    static Comparator<UserResponse> userSorter(String sort) {
        return switch (sort == null ? "" : sort.trim()) {
            case "", "email" -> Comparator.comparing(UserResponse::email, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "-email" -> Comparator.comparing(UserResponse::email, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                    .reversed();
            case "displayName" -> Comparator.comparing(
                    UserResponse::displayName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "-displayName" -> Comparator.comparing(
                            UserResponse::displayName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                    .reversed();
            case "username" -> Comparator.comparing(
                    UserResponse::username, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
            case "-username" -> Comparator.comparing(
                            UserResponse::username, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                    .reversed();
            case "createdAt" -> Comparator.comparing(UserResponse::createdAt);
            case "-createdAt" -> Comparator.comparing(UserResponse::createdAt).reversed();
            case "updatedAt" -> Comparator.comparing(UserResponse::updatedAt);
            case "-updatedAt" -> Comparator.comparing(UserResponse::updatedAt).reversed();
            default -> throw ApiException.badRequest("invalid_sort", "Unknown sort property: " + sort);
        };
    }

    private int cappedSize(int size) {
        return Math.min(Math.max(size, 1), properties.rest().maxPageSize());
    }
}