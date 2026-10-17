-- Avatar of a user account. The image is normalized on upload and stored in the
-- object storage in two PNG renditions: a larger one for the profile page and a
-- smaller one for the avatar of the profile menu. `profile_overridden` marks an
-- account whose display name and email are owned by the application from now on,
-- so the identity provider no longer overwrites them on the next request.
alter table user_account
    add column avatar_key             varchar(1024),
    add column avatar_thumbnail_key   varchar(1024),
    add column avatar_content_type    varchar(255),
    add column avatar_updated_at      timestamptz,
    add column profile_overridden     boolean not null default false;
