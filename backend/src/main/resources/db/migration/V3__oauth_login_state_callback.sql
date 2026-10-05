-- A login may now start on any of the frontend origins, so the state has to
-- remember which callback was sent to the provider: the code exchange must
-- repeat it verbatim and the session cookies are only valid for the frontend
-- that started the login.
--
-- The column stays nullable on purpose. A row that was created before this
-- migration has no callback of its own and falls back to the configured default
-- at runtime, so no login state has to be thrown away during an upgrade.
alter table auth_login_state add column callback_uri varchar(512);