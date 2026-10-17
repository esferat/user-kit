package com.acme.usermark.user;

import com.acme.usermark.common.ReadOnlyFields;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
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

    private final AuthenticatedUserService userService;
    private final ProfileService profileService;

    public MeController(AuthenticatedUserService userService, ProfileService profileService) {
        this.userService = userService;
        this.profileService = profileService;
    }

    @GetMapping
    @Operation(summary = "Returns the profile of the current access token")
    public MeResponse me() {
        return MeResponse.from(userService.currentUser());
    }

    @PatchMapping
    @Operation(summary = "Updates the editable base data of the profile")
    public MeResponse patch(
            @RequestBody(required = false) MePatch patch,
            @RequestHeader(value = "If-Match", required = false) String ifMatch) {
        if (patch != null) {
            patch.rejectReadOnly();
        }
        UserAccount account = userService.currentUser();
        UserAccount updated = profileService.update(
                account.getId(),
                patch == null ? null : patch.displayName(),
                patch == null ? null : patch.email(),
                ifMatch);
        return MeResponse.from(updated);
    }

    @PostMapping(path = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Uploads an avatar, stores it in two sizes and returns the profile")
    public MeResponse uploadAvatar(
            @Parameter(description = "Image of the avatar") @RequestParam("file") MultipartFile file) {
        UserAccount account = userService.currentUser();
        return MeResponse.from(profileService.saveAvatar(account.getId(), file));
    }

    @DeleteMapping(path = "/avatar")
    @Operation(summary = "Removes the avatar of the profile")
    public MeResponse deleteAvatar() {
        UserAccount account = userService.currentUser();
        return MeResponse.from(profileService.removeAvatar(account.getId()));
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
        UserAccount account = userService.currentUser();
        byte[] content = profileService.avatarContent(account, thumbnail);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        account.getAvatarContentType() == null ? ProfileService.AVATAR_CONTENT_TYPE
                                : account.getAvatarContentType()))
                .contentLength(content.length)
                // The URL carries the upload timestamp, so the browser may keep the
                // private image for a while without ever showing the previous one.
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .body(content);
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

    public record MeResponse(
            UUID id,
            String subject,
            String username,
            String email,
            String displayName,
            List<String> roles,
            boolean enabled,
            long version,
            Instant createdAt,
            Instant updatedAt,
            String avatarUrl,
            String avatarThumbnailUrl,
            Instant avatarUpdatedAt,
            String etag) {

        public static MeResponse from(UserAccount account) {
            return new MeResponse(
                    account.getId(),
                    account.getSubject(),
                    account.getUsername(),
                    account.getEmail() == null ? "" : account.getEmail(),
                    account.getDisplayName(),
                    account.getRoles().stream().sorted().toList(),
                    account.isEnabled(),
                    account.getVersion(),
                    account.getCreatedAt(),
                    account.getUpdatedAt(),
                    ProfileService.avatarUrl(account, false),
                    ProfileService.avatarUrl(account, true),
                    account.getAvatarUpdatedAt(),
                    EtagSupport.of(account.getVersion()));
        }
    }
}
