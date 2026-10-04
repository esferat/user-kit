create table user_account
(
    id           uuid primary key,
    subject      varchar(255) not null unique,
    username     varchar(255) not null,
    email        varchar(320),
    display_name varchar(255) not null,
    enabled      boolean      not null default true,
    version      bigint       not null default 0,
    created_at   timestamptz  not null default now(),
    updated_at   timestamptz  not null default now()
);

create table user_account_role
(
    user_id uuid         not null references user_account (id) on delete cascade,
    role    varchar(32) not null,
    primary key (user_id, role)
);

create index idx_user_account_role_role on user_account_role (role);

create table file_object
(
    id           uuid primary key,
    name         varchar(512)  not null,
    description  varchar(2000),
    content_type varchar(255)  not null,
    size_bytes   bigint        not null,
    checksum     varchar(64),
    storage_key  varchar(1024) not null unique,
    owner_id     uuid          not null references user_account (id) on delete cascade,
    version      bigint        not null default 0,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now()
);

create index idx_file_object_owner_created on file_object (owner_id, created_at desc);
