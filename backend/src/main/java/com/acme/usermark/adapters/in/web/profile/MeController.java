package com.acme.usermark.adapters.in.web.profile;

import com.acme.usermark.adapters.in.security.CallerResolver;
import com.acme.usermark.adapters.in.web.ReadOnlyFields;
import com.acme.usermark.adapters.in.web.Uploads;
import com.acme.usermark.application.account.CallerContext;
import com.acme.usermark.application.account.CurrentAccountService;
import com.acme.usermark.application.profile.ProfileDto;
import com.acme.usermark.application.profile.ProfileUseCases;
import com.acme.usermark.application.profile.UpdateProfileCommand;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Profile of the authenticated account: base data and avatar. */
@RestController
@RequestMapping(path = "/api/v1/me", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "Profile", description = "The authenticated profile")
public class MeController {

    private final CurrentAccountService accounts;
    private final ProfileUseCases profiles;
    private final CallerResolver callers;

    public MeController(
            CurrentAccountService accounts, ProfileUseCases profiles, CallerResolver callers) {
        this.accounts = accounts;
        this.profiles = profiles;
        this.callers = callers;
    }

    @GetMapping
    @Operation(summary = "Returns the profile of the current access token")
    public ProfileDto me() {
        return profiles.profile(caller());
    }

    @PatchMapping
    @Operation(summary = "Updates the editable base data of the profile")
    public ProfileDto patch(
            @RequestBody(required = false) MePatch patch,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        if (patch != null) {
            patch.rejectReadOnly();
        }
        return profiles.update(
                caller(),
                new UpdateProfileCommand(
                        patch == null ? null : patch.displayName(),
                        patch == null ? null : patch.email(),
                        ifMatch));
    }

    @PostMapping(path = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Uploads an avatar, stores it in two sizes and returns the profile")
    public ProfileDto uploadAvatar(
            @Parameter(description = "Image of the avatar") @RequestParam("file") MultipartFile file) {
        return profiles.saveAvatar(caller(), Uploads.of(file, ProfileUseCases.AVATAR_MAX_BYTES));
    }

    @DeleteMapping(path = "/avatar")
    @Operation(summary = "Removes the avatar of the profile")
    public ProfileDto deleteAvatar() {
        return profiles.removeAvatar(caller());
    }

    @GetMapping(path = "/avatar", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @Operation(summary = "Returns the avatar for the profile page")
    public ResponseEntity<byte[]> avatar() {
        return avatarResponse(false);
    }

    @GetMapping(path = "/avatar/thumbnail", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @Operation(summary = "Returns the small avatar for the profile menu")
    public ResponseEntity<byte[]> avatarThumbnail() {
        return avatarResponse(true);
    }

    private ResponseEntity<byte[]> avatarResponse(boolean thumbnail) {
        ProfileUseCases.AvatarContent avatar = profiles.avatarContent(caller(), thumbnail);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.contentType()))
                .contentLength(avatar.content().length)
                // The URL carries the upload timestamp, so the browser may keep the
                // private image for a while without ever showing the previous one.
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(avatar.content());
    }

    /** The caller of the request, resolved from the access token. */
    private CallerContext caller() {
        return accounts.resolve(callers.current());
    }

    /**
     * Patch payload of the profile. Read-only properties are part of the record on
     * purpose: they are deserialized so the request can be rejected with
     * {@code read_only_property} instead of being ignored, and unknown properties
     * are rejected by the globally strict Jackson configuration.
     */
    public record MePatch(
            UUID id,
            String etag,
            String subject,
            String username,
            List<String> roles,
            Boolean enabled,
            Long version,
            String displayName,
            String email,
            String avatarUrl,
            String avatarThumbnailUrl,
            String avatarUpdatedAt,
            String createdAt,
            String updatedAt) {

        public void rejectReadOnly() {
            ReadOnlyFields.reject("Profile", "id", id == null ? null : id.toString());
            ReadOnlyFields.reject("Profile", "etag", etag);
            ReadOnlyFields.reject("Profile", "subject", subject);
            ReadOnlyFields.reject("Profile", "username", username);
            ReadOnlyFields.reject("Profile", "roles", roles);
            ReadOnlyFields.reject("Profile", "enabled", enabled);
            ReadOnlyFields.reject("Profile", "version", version);
            ReadOnlyFields.reject("Profile", "avatarUrl", avatarUrl);
            ReadOnlyFields.reject("Profile", "avatarThumbnailUrl", avatarThumbnailUrl);
            ReadOnlyFields.reject("Profile", "avatarUpdatedAt", avatarUpdatedAt);
            ReadOnlyFields.reject("Profile", "createdAt", createdAt);
            ReadOnlyFields.reject("Profile", "updatedAt", updatedAt);
        }
    }
}
