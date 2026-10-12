# Architecture

This document describes how the components fit together, which decisions were taken and why.

## Runtime topology

```
                            ┌──────────────────────────────────────────────┐
   browser  ──────────────► │ edge (nginx, 80 + 443)                       │
                            │  user-kit.local       /       → frontend-antd│
                            │  user-kit.local       /api/   → backend:8080 │
                            │  user-kit.local       /auth/  → keycloak     │
                            │  user-kit.mui.local   /       → frontend-mui │
                            │  user-kit.mui.local   /auth/  → 308 canonical│
                            │  user-kit.next.local  /       → next:3000    │
                            │  user-kit.next.local  /auth/  → 308 canonical│
                            │  user-kit.kibana.local/       → kibana       │
                            │  /api/v1/, /v3/api-docs, /swagger-ui → backend│
                            │  /healthz                     → answered here │
                            └───────────────────┬──────────────────────────┘
                                                │ HTTP inside the compose network
                              ┌─────────────────▼──────────────────┐
                              │ backend (Spring Boot, Java 21)     │
                              └───────┬───────────────┬────────────┘
                                      │               │
                          ┌───────────▼───┐   ┌───────▼───────────┐
                          │ PostgreSQL 17 │   │ S3 / Silo         │
                          │ Flyway        │   │ file content      │
                          └───────────────┘   └───────────────────┘
                                                ▲
                                                │ JWKS, issuer is the public URL
                                 ┌──────────────┴─────────────┐
                                 │ OpenID Connect IdP         │
                                 │ (Keycloak, /auth)          │
                                 └────────────────────────────┘
```

`frontend-antd/` and `frontend-mui/` implement the same screens on top of the same REST API, but with
different component libraries (Ant Design + MobX, Material UI + Redux Toolkit). `fullstack-next/` is a
Next.js application on its own domain and is still the default scaffold. All domains talk to the same
backend but keep their own cookie session, because the cookies are scoped to the host. The identity
provider lives on the canonical domain only, so the other domains redirect `/auth` to it and every
application sees the same `iss`. `SERVER_NAME_KIBANA` is not an application: the edge proxies it to the
Kibana container of the logging stack, so the log UI shares the TLS edge of the applications.

## Layers

| Layer       | Where                                                       | Responsibility                                                          |
| ----------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Edge        | `nginx/templates`                                           | TLS termination, proxy, security headers, host routing                  |
| Frontends   | `frontend-antd/`, `frontend-mui/`                           | UI, state (MobX / Redux), session, API calls                            |
| Next.js     | `fullstack-next/`                                           | Full stack app (scaffold), served by the edge on the third domain       |
| API         | `backend/.../file`, `.../user`, `.../auth`, `.../common`    | REST controllers, DTO mapping, authorization, error shape               |
| Domain      | `backend/.../file`, `backend/.../user`                      | Services, `@Version` optimistic locking, `ETag`, validation             |
| Persistence | `backend/.../file`, `.../user`, Flyway `db/migration`       | JPA entities and schema                                                 |
| Storage     | `backend/.../storage`                                       | S3 compatible object storage                                            |
| Identity    | `backend/.../auth`, `.../security`, `keycloak/realm`        | OAuth client, JWT resource server, realm import                         |

## Key decisions

### Two React frontends instead of one

`frontend-antd/` and `frontend-mui/` are complete implementations of the same screens with two
different component libraries and two different state libraries (MobX versus Redux Toolkit). They
share the API contract and the `shared/api/http.ts` helper but not a UI package: the duplication is
deliberate so each application stays idiomatic for its library. A change to the REST contract has to
be mirrored in both.

### REST instead of OData

The first iteration exposed an OData V4 subset ($filter/$select/$orderby/$top/$skip/$count) through a
hand written parser and query engine. The cost (a parser, a query engine, metadata documents, and a
contract most frontend developers do not know) outweighed the benefit for two entities. The API now
uses plain REST with a small, explicit query interface:

- `GET /api/v1/files?search=&sort=&page=&size=` and the same for `/api/v1/users`.
- `search` is a case-insensitive substring over a fixed set of columns.
- `sort` accepts a named key with an optional `-` prefix; an unknown key is rejected with `400`.
- `size` is clamped to `REST_MAX_PAGE_SIZE`, so a huge value cannot exhaust memory.
- Reading uses `GET`, writing uses `PATCH`/`DELETE` with `If-Match`/`ETag`.

Search and sorting are implemented in the service layer against typed queries; no user supplied string
is concatenated into SQL or JPQL.

### DTOs at the service boundary

`FileService` returns `FileResponse` DTOs instead of JPA entities, and the entity to DTO mapping runs
inside the transactional method. `UserAdminService` returns `UserResponse` the same way. Two problems
are solved by this:

- No lazy association is touched after the transaction closed (`spring.jpa.open-in-view` is disabled
  deliberately, so such a failure surfaces as HTTP 500 instead of a hidden extra query).
- Optimistic locking is flushed before the response is built, so the returned `ETag` already contains
  the new version number.

`spring.jpa.open-in-view: false` plus explicit `join fetch` queries in the repositories guarantees
that every read which needs the owner has it loaded. `FileObject.owner` is additionally mapped as
`FetchType.EAGER`, so a detached owner can no longer turn into a `LazyInitializationException` when a
file leaves the service layer.

### Object storage: Silo in compose, S3 everywhere else

`FileStorageService` speaks plain S3 with the AWS SDK v2, so Silo, AWS S3, Ceph or Garage only need the
endpoint, region, credentials and `S3_PATH_STYLE`. The compose file runs
`${SILO_IMAGE:-pgsty/silo}:${SILO_VERSION:-latest}` with path style addressing. Silo is a community
maintained fork of the MinIO server, so it keeps the S3 API, the storage format, the reserved
`/minio/*` routes and the `MINIO_*` environment variables; `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`
are therefore fed from `S3_ACCESS_KEY` and `S3_SECRET_KEY` and the backend and the container always use
the same credentials. Only the web console is published (`SILO_CONSOLE_PORT`, default `9001`), the S3
API stays inside the compose network. `SILO_IMAGE` exists for environments that cannot pull from
Docker Hub: point it at a mirror or at an image you are allowed to pull without changing the compose
file.

Silo needs a few seconds longer to accept connections than a local filesystem, so `ensureBucket`
retries both the bucket check and the bucket creation for about 20 seconds before it gives up. The
bucket is created on startup when `S3_CREATE_BUCKET=true`.

### Roles: two values, first login wins

Accounts have exactly two roles, `admin` and `user`, and `admin` is exclusive. The first login creates
the account; an administrator can later change `roles` and `enabled`. Authorization is enforced on the
server for every endpoint through Spring Security; the frontend only hides UI it cannot call.

### Authentication: backend as OAuth client

The backend is the confidential OAuth client (`OIDC_CLIENT_ID`, default `user-kit-bff`). The browser
gets httpOnly cookies (`user-kit.session` and a CSRF cookie) and never sees an access or refresh
token. `OIDC_CLIENT_REDIRECT_URIS` lists one callback per frontend domain; the login state row stores
the callback that was used, so a login returns to the domain it started on even though the provider
lives on the canonical domain. `/api/v1/auth/config` tells the frontend which login methods are
available (`oidc`, `dev` or `none`) and whether self registration is offered (`registrationEnabled`),
so the bundle carries no provider configuration. `GET /api/v1/auth/register` starts the same code flow
against the registration page of the provider, so a new account lands in the same session.

`SessionTokenFilter` refreshes the access token when it is about to expire; `EtagSupport` maps the JPA
`@Version` to a weak `W/"<version>"` ETag and verifies `If-Match` on PATCH and DELETE.

## Data model

```
user_account                          file_object
────────────                          ───────────
id              uuid  PK             id              uuid  PK
subject         text unique           name            text
username        text                  description     text nullable
email           text                  content_type    text
display_name    text                  size_bytes      bigint
roles           text[]                checksum        text nullable
enabled         boolean               storage_key     text unique
created_at      timestamptz           owner_id        uuid FK -> user_account
updated_at      timestamptz           version         bigint
version         bigint                created_at      timestamptz
                                       updated_at      timestamptz

auth_login_state                      auth_session
──────────────                        ────────────
state_hash   text PK                  id_hash               text PK
redirect_uri text                     subject               text
code_verifier text                    client_id             text
expires_at   timestamptz              access_token_expires_at timestamptz
created_at   timestamptz              refresh_token         text nullable
                                      id_token              text nullable
                                      created_at            timestamptz
                                      updated_at            timestamptz
```

`subject` is the stable identifier of the account at the identity provider (`sub` claim). File content
never reaches the database; `storage_key` points to the object storage and `checksum` stores the
SHA-256 of the uploaded bytes.

Both auth tables hold a hash, never a value the browser presents: `state_hash` and `id_hash` are
SHA-256 of the random values in the cookies, so a dump of the database does not allow a session to be
hijacked. Only `auth_session.refresh_token` is stored as issued, because the provider requires it for
the next refresh.

## Request flow example

Upload of `report.pdf` as user `jane`:

1. Browser sends `POST /api/v1/files` with a `multipart/form-data` body, its cookies and the
   `X-XSRF-TOKEN` header. A command line client sends `Authorization: Bearer` instead and skips CSRF.
2. nginx terminates TLS and forwards the request to the backend.
3. `CookieAwareBearerTokenResolver` picks the token of a command line client from the header,
   `SessionTokenFilter` renews the token of a cookie session if it is about to expire and turns it into
   the authentication, and `OidcJwtAuthenticationConverter` maps the claims to authorities.
4. `AuthenticatedUserService` loads or creates the `UserAccount` for `sub` and returns the entity.
5. `FileService.upload` validates name, size and content type, computes the checksum and the
   `files/2026/10/<uuid>/report.pdf` key.
6. `FileStorageService.put` writes the object and returns the created `FileResponse` with
   `ETag: W/"0"`.
7. If the database insert fails afterwards, the object is deleted again so that no orphan remains.

## Observability

The backend logs one line per event in the format `[level]-[date]- message` and, when `LOG_FILE` is
set, mirrors the stream into a file of the `backend-logs` volume. Logstash tails that file, parses the
three parts with a grok filter, folds Java stack traces onto their first line with the multiline codec
and indexes the events into the `user-kit-backend-<date>` indices of Elasticsearch. Kibana reads the
indices behind the edge proxy on `SERVER_NAME_KIBANA`, so the pipeline never touches the request path: a
slow or down log collector cannot slow the API down, and the console output of `docker compose logs
backend` stays the single source of truth for a local run.

## Scaling notes

- The backend is stateless; horizontal scaling only requires a shared database and bucket.
- Uploads are read fully into memory (`byte[]`), which is fine for the configured 25 MB limit. For
  larger objects use streaming with `RequestBody.fromInputStream` and a multipart upload.
- Search, sorting and paging run against the database with a bounded page size, so the hot path stays
  predictable as the collections grow.
