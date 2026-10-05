-- Server side state of the cookie based login: the refresh token of the identity
-- provider never reaches the browser, so it lives here together with the session
-- id that the browser holds as a cookie. Only a hash of the value that the
-- browser carries is stored, so a database dump cannot be replayed as a session.
create table auth_session
(
    id_hash                 varchar(64)  not null primary key,
    subject                 varchar(255) not null,
    client_id               varchar(255) not null,
    access_token_expires_at timestamptz  not null,
    refresh_token           text,
    id_token                text,
    created_at              timestamptz  not null default now(),
    updated_at              timestamptz  not null default now()
);

create index idx_auth_session_subject on auth_session (subject);
create index idx_auth_session_updated on auth_session (updated_at);

-- One row per started login: the state protects the authorization code exchange
-- against cross site request forgery and binds it to a redirect target, the code
-- verifier is the PKCE counterpart of that protection.
create table auth_login_state
(
    state_hash   varchar(64)  not null primary key,
    redirect_uri varchar(512) not null,
    code_verifier varchar(128) not null,
    created_at   timestamptz  not null default now(),
    expires_at   timestamptz  not null
);

create index idx_auth_login_state_expires on auth_login_state (expires_at);