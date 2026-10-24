package com.acme.usermark.application.profile;

import com.acme.usermark.application.account.CallerContext;
import com.acme.usermark.domain.account.Account;
import com.acme.usermark.domain.account.AccountRepository;
import com.acme.usermark.domain.file.FileStorage;
import com.acme.usermark.domain.file.FileUpload;
import com.acme.usermark.domain.shared.DomainException;
import com.acme.usermark.domain.shared.Etag;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Use cases of the profile of the authenticated account: the editable base data
 * and the avatar, which lives in the object storage in two sizes.
 *
 * <p>The stored renditions are always square PNG images, so the profile page and
 * the profile menu can size them freely without a distortion.
 */
@Component
public class ProfileUseCases {

    /** Edge length of the rendition the profile page shows, in pixels. */
    public static final int AVATAR_SIZE = 512;
    /** Edge length of the rendition the profile menu shows, in pixels. */
    public static final int AVATAR_THUMBNAIL_SIZE = 64;
    /** Upload bound of an avatar; the servlet limit of the application is higher. */
    public static final long AVATAR_MAX_BYTES = 5L * 1024 * 1024;
    public static final String AVATAR_CONTENT_TYPE = "image/png";
    public static final String AVATAR_URL = "/api/v1/me/avatar";
    public static final String AVATAR_THUMBNAIL_URL = "/api/v1/me/avatar/thumbnail";

    private static final int MAX_DISPLAY_NAME_LENGTH = 255;
    private static final int MAX_EMAIL_LENGTH = 320;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final AccountRepository accounts;
    private final FileStorage storage;

    public ProfileUseCases(AccountRepository accounts, FileStorage storage) {
        this.accounts = accounts;
        this.storage = storage;
    }

    /** The profile of the caller. */
    @Transactional(readOnly = true)
    public ProfileDto profile(CallerContext caller) {
        return ProfileDto.from(require(caller.id()));
    }

    @Transactional
    public ProfileDto update(CallerContext caller, UpdateProfileCommand command) {
        Account account = require(caller.id());
        Etag.verify(command.ifMatch(), account.version());
        if (command.displayName() != null) {
            account.changeDisplayName(requireDisplayName(command.displayName()));
            account.overrideProfile();
        }
        if (command.email() != null) {
            account.changeEmail(requireEmail(command.email()));
            account.overrideProfile();
        }
        account.touch();
        return ProfileDto.from(accounts.save(account));
    }

    @Transactional
    public ProfileDto saveAvatar(CallerContext caller, FileUpload upload) {
        if (upload == null || upload.content().length == 0) {
            throw DomainException.validation("empty_file", "The uploaded avatar is empty");
        }
        if (upload.content().length > AVATAR_MAX_BYTES) {
            throw DomainException.payloadTooLarge(
                    "The avatar is larger than the configured limit of " + AVATAR_MAX_BYTES + " bytes");
        }
        AvatarImages.Rendered rendered = AvatarImages.render(upload.content(), AVATAR_SIZE, AVATAR_THUMBNAIL_SIZE);

        Account account = require(caller.id());
        // A fresh folder per upload keeps the renditions cacheable by URL and makes
        // the object storage the only place a replaced image can be found.
        String folder = "avatars/" + account.id() + "/" + UUID.randomUUID();
        String key = folder + "/full.png";
        String thumbnailKey = folder + "/thumbnail.png";
        storage.put(key, rendered.full(), AVATAR_CONTENT_TYPE);
        storage.put(thumbnailKey, rendered.thumbnail(), AVATAR_CONTENT_TYPE);

        String previousKey = account.avatarKey();
        String previousThumbnailKey = account.avatarThumbnailKey();
        account.applyAvatar(key, thumbnailKey, AVATAR_CONTENT_TYPE);
        account.touch();
        try {
            Account saved = accounts.save(account);
            deleteAfterCommit(previousKey, previousThumbnailKey);
            return ProfileDto.from(saved);
        } catch (RuntimeException exception) {
            storage.delete(key);
            storage.delete(thumbnailKey);
            throw exception;
        }
    }

    @Transactional
    public ProfileDto removeAvatar(CallerContext caller) {
        Account account = require(caller.id());
        if (!account.hasAvatar()) {
            return ProfileDto.from(account);
        }
        String previousKey = account.avatarKey();
        String previousThumbnailKey = account.avatarThumbnailKey();
        account.clearAvatar();
        account.touch();
        Account saved = accounts.save(account);
        deleteAfterCommit(previousKey, previousThumbnailKey);
        return ProfileDto.from(saved);
    }

    /** Content of one of the two renditions; the caller already resolved the account. */
    @Transactional(readOnly = true)
    public AvatarContent avatarContent(CallerContext caller, boolean thumbnail) {
        Account account = require(caller.id());
        String key = thumbnail ? account.avatarThumbnailKey() : account.avatarKey();
        if (key == null) {
            throw DomainException.notFound("The account has no avatar");
        }
        String contentType = account.avatarContentType() == null ? AVATAR_CONTENT_TYPE : account.avatarContentType();
        return new AvatarContent(contentType, storage.getBytes(key));
    }

    /** One rendition of the avatar and the type it is stored with. */
    public record AvatarContent(String contentType, byte[] content) {}

    /**
     * URL of a rendition, or {@code null} while no avatar is set. The version
     * parameter changes with every upload, so a cached image of the previous avatar
     * is never reused.
     */
    public static String avatarUrl(Account account, boolean thumbnail) {
        if (!account.hasAvatar() || account.avatarUpdatedAt() == null) {
            return null;
        }
        String path = thumbnail ? AVATAR_THUMBNAIL_URL : AVATAR_URL;
        return path + "?v=" + account.avatarUpdatedAt().toEpochMilli();
    }

    private Account require(UUID id) {
        return accounts
                .findById(id)
                .orElseThrow(() -> DomainException.notFound("User " + id + " does not exist"));
    }

    private String requireDisplayName(String displayName) {
        String trimmed = displayName.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_DISPLAY_NAME_LENGTH) {
            throw DomainException.validation(
                    "invalid_profile", "displayName must contain 1 to " + MAX_DISPLAY_NAME_LENGTH + " characters");
        }
        return trimmed;
    }

    /** An empty email clears the field, everything else has to look like an address. */
    private String requireEmail(String email) {
        String trimmed = email.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_EMAIL_LENGTH || !EMAIL.matcher(trimmed).matches()) {
            throw DomainException.validation("invalid_profile",
                    "email must be a valid address of up to " + MAX_EMAIL_LENGTH + " characters");
        }
        return trimmed;
    }

    /** Best effort cleanup that only runs after the row is committed. */
    private void deleteAfterCommit(String... keys) {
        List<String> expired = new ArrayList<>();
        for (String key : keys) {
            if (key != null) {
                expired.add(key);
            }
        }
        if (expired.isEmpty()) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    expired.forEach(storage::delete);
                }
            });
            return;
        }
        expired.forEach(storage::delete);
    }
}
