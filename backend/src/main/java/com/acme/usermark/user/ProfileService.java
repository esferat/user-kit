package com.acme.usermark.user;

import com.acme.usermark.common.ApiException;
import com.acme.usermark.storage.FileStorageService;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/**
 * Profile use cases of the authenticated account: the editable base data and the
 * avatar, which lives in the object storage in two sizes.
 *
 * <p>The stored renditions are always square PNG images, so the profile page and
 * the profile menu can size them freely without a distortion.
 */
@Service
public class ProfileService {

    /** Edge length of the rendition the profile page shows, in pixels. */
    static final int AVATAR_SIZE = 512;
    /** Edge length of the rendition the profile menu shows, in pixels. */
    static final int AVATAR_THUMBNAIL_SIZE = 64;
    /** Upload bound of an avatar; the servlet limit of the application is higher. */
    static final long AVATAR_MAX_BYTES = 5L * 1024 * 1024;
    static final String AVATAR_CONTENT_TYPE = "image/png";
    static final String AVATAR_URL = "/api/v1/me/avatar";
    static final String AVATAR_THUMBNAIL_URL = "/api/v1/me/avatar/thumbnail";

    private static final int MAX_DISPLAY_NAME_LENGTH = 255;
    private static final int MAX_EMAIL_LENGTH = 320;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final UserAccountRepository repository;
    private final FileStorageService storage;

    public ProfileService(UserAccountRepository repository, FileStorageService storage) {
        this.repository = repository;
        this.storage = storage;
    }

    @Transactional
    public UserAccount update(UUID id, String displayName, String email, String ifMatch) {
        UserAccount account = require(id);
        EtagSupport.verify(ifMatch, account.getVersion());
        if (displayName != null) {
            account.setDisplayName(requireDisplayName(displayName));
            account.setProfileOverridden(true);
        }
        if (email != null) {
            account.setEmail(requireEmail(email));
            account.setProfileOverridden(true);
        }
        account.touch();
        return repository.saveAndFlush(account);
    }

    @Transactional
    public UserAccount saveAvatar(UUID id, MultipartFile upload) {
        if (upload == null || upload.isEmpty()) {
            throw ApiException.badRequest("empty_file", "The uploaded avatar is empty");
        }
        if (upload.getSize() > AVATAR_MAX_BYTES) {
            throw ApiException.payloadTooLarge(
                    "The avatar is larger than the configured limit of " + AVATAR_MAX_BYTES + " bytes");
        }
        AvatarImages.Rendered rendered = AvatarImages.render(read(upload), AVATAR_SIZE, AVATAR_THUMBNAIL_SIZE);

        UserAccount account = require(id);
        // A fresh folder per upload keeps the renditions cacheable by URL and makes
        // the object storage the only place a replaced image can be found.
        String folder = "avatars/" + account.getId() + "/" + UUID.randomUUID();
        String key = folder + "/full.png";
        String thumbnailKey = folder + "/thumbnail.png";
        storage.put(key, rendered.full(), AVATAR_CONTENT_TYPE);
        storage.put(thumbnailKey, rendered.thumbnail(), AVATAR_CONTENT_TYPE);

        String previousKey = account.getAvatarKey();
        String previousThumbnailKey = account.getAvatarThumbnailKey();
        account.applyAvatar(key, thumbnailKey, AVATAR_CONTENT_TYPE);
        account.touch();
        try {
            UserAccount saved = repository.saveAndFlush(account);
            deleteAfterCommit(previousKey, previousThumbnailKey);
            return saved;
        } catch (RuntimeException exception) {
            storage.delete(key);
            storage.delete(thumbnailKey);
            throw exception;
        }
    }

    @Transactional
    public UserAccount removeAvatar(UUID id) {
        UserAccount account = require(id);
        if (!account.hasAvatar()) {
            return account;
        }
        String previousKey = account.getAvatarKey();
        String previousThumbnailKey = account.getAvatarThumbnailKey();
        account.clearAvatar();
        account.touch();
        UserAccount saved = repository.saveAndFlush(account);
        deleteAfterCommit(previousKey, previousThumbnailKey);
        return saved;
    }

    /** Content of one of the two renditions; the caller already resolved the account. */
    @Transactional(readOnly = true)
    public byte[] avatarContent(UserAccount account, boolean thumbnail) {
        String key = thumbnail ? account.getAvatarThumbnailKey() : account.getAvatarKey();
        if (key == null) {
            throw ApiException.notFound("The account has no avatar");
        }
        return storage.get(key);
    }

    /**
     * URL of a rendition, or {@code null} while no avatar is set. The version
     * parameter changes with every upload, so a cached image of the previous avatar
     * is never reused.
     */
    static String avatarUrl(UserAccount account, boolean thumbnail) {
        if (!account.hasAvatar() || account.getAvatarUpdatedAt() == null) {
            return null;
        }
        String path = thumbnail ? AVATAR_THUMBNAIL_URL : AVATAR_URL;
        return path + "?v=" + account.getAvatarUpdatedAt().toEpochMilli();
    }

    private UserAccount require(UUID id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("User " + id + " does not exist"));
    }

    private String requireDisplayName(String displayName) {
        String trimmed = displayName.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_DISPLAY_NAME_LENGTH) {
            throw ApiException.badRequest(
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
            throw ApiException.badRequest("invalid_profile", "email must be a valid address of up to "
                    + MAX_EMAIL_LENGTH + " characters");
        }
        return trimmed;
    }

    private byte[] read(MultipartFile upload) {
        try (InputStream stream = upload.getInputStream()) {
            return stream.readAllBytes();
        } catch (IOException exception) {
            throw ApiException.badRequest("unreadable_upload", "The uploaded avatar could not be read");
        }
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
