# Architecture

This document describes how the components fit together, which decisions were taken and why.

## Runtime topology

```
                    ┌────────────────────────────────────────────────────────┐
   browser  ───────► │ edge (nginx, 80 + 443)                                 │
                    │  user-kit.ui5.local  /            → frontend (static)    │
                    │  user-kit.ui5.local  /api/        → backend:8080         │
                    │  user-kit.ui5.local  /auth/       → keycloak:8080        │
                    │  user-kit.ant.local  /            → frontend-antd        │
                    │  user-kit.ant.local  /api/        → backend:8080         │
                    │  user-kit.ant.local  /auth/       → 308 to the canonical │
                    │  /odata/, /v3/api-docs, /swagger-ui → backend:8080      │
                    │  /healthz                         → answered by nginx    │
                    └────────────────────┬───────────────────────────────────────┘
                                         │ HTTP inside the compose network
                        ┌────────────────▼─────────────────┐
                        │ backend (Spring Boot, Java 21)  │
                        └───────┬──────────────┬───────────┘
                                │              │
                    ┌───────────▼───┐   ┌──────▼──────────────┐
                    │ PostgreSQL 17 │   │ S3 / Silo         │
                    │ Flyway       │   │ file content       │
                    └───────────────┘   └─────────────────────┘
                                          ▲
                                          │ JWKS, issuer is the public URL
                               ┌──────────┴───────────┐
                               │ OpenID Connect IdP   │
                               │ (Keycloak, /auth)    │
                               └──────────────────────┘
```

Both frontends are the same application on a different component library: `frontend/` renders with UI5
Web Components, `frontend-antd/` with Ant Design. They share one backend and keep separate sessions,
because the session cookies are scoped to the host. A login therefore never crosses a domain: the
backend picks the callback of the requesting origin and stores it in the login state, and the provider
lives on the canonical domain only so that both applications see the same `iss`.

## Layers

| Layer | Package / folder | Responsibility |
| --- | --- | --- |
| Edge | `nginx/` | TLS, security headers, routing, request size limit, gzip, two server names |
| UI | `frontend/src/app`, `.../pages`, `.../widgets` | Composition root, shell, pages and tables, no business rules |
| Domain | `frontend/src/features`, `.../entities` | Use cases, user and file operations, role extraction |
| Transport | `frontend/src/shared/api` | Typed HTTP client, OData query building, error mapping |
| Shared | `frontend/src/shared/{config,i18n,lib,ui}` | Environment configuration, translations, React hooks, formatting, router |
| API | `backend/.../file`, `.../odata`, `.../user` | Endpoints, authorization checks, DTO mapping |
| Domain services | `backend/.../file/FileService`, `.../user/UserAdminService` | Use cases, transactions, validation |
| Persistence | `backend/.../repository`, `db/migration` | JPA entities, Flyway DDL |
| Infrastructure | `backend/.../config` | Security, JWT, S3 client, OpenAPI, properties |

## Decisions

### React on UI5 Web Components instead of XML views

The official SAPUI5 toolchain is [UI5 CLI](https://ui5.github.io/cli/v4) based: it compiles
`*.view.xml` into JavaScript and resolves them through a module loader. That build cannot be
reproduced with a plain Vite pipeline. The application therefore renders the same Fiori
components (`ShellBar`, `Table`, `Dialog`, `FileUploader`, `MessageStrip`) through the React
wrappers of `@ui5/webcomponents-react`, which keeps the visual result close to a SAPUI5
application while remaining a standard TypeScript project. The imperative UI5 web components
stay the foundation; React only owns the state, the composition and the lifecycle. See
[`frontend.md`](frontend.md).

### DTOs at the service boundary

`FileService` returns API DTOs (`FileResponse`, `FileDownload`) instead of JPA entities, and the
entity to DTO mapping runs inside the transactional method. `UserAdminService` still returns
`UserAccount`, which is safe because every association it exposes (`roles`) is eagerly loaded; the
OData controller maps it with `ODataMappings.user` right after the call. Two problems are solved by
this:

- No lazy association is touched after the transaction closed (`spring.jpa.open-in-view` is
  disabled deliberately, so such a failure surfaces as HTTP 500 instead of a hidden extra query).
- Optimistic locking is flushed before the response is built, so the returned `ETag` already
  contains the new version number.

`spring.jpa.open-in-view: false` plus explicit `join fetch` queries in `FileObjectRepository`
guarantees that every read which needs the owner has it loaded. `FileObject.owner` is additionally
mapped as `FetchType.EAGER`, so a detached owner can no longer turn into a `LazyInitializationException`
when a file leaves the service layer.

### Object storage: Silo in compose, S3 everywhere else

`FileStorageService` speaks plain S3 with the AWS SDK v2, so Silo, AWS S3, Ceph or Garage only
need the endpoint, region, credentials and `S3_PATH_STYLE`. The compose file runs
`${SILO_IMAGE:-pgsty/silo}:${SILO_VERSION:-latest}` with path style addressing. Silo is a community
maintained fork of the MinIO server, so it keeps the S3 API, the storage format, the reserved
`/minio/*` routes and the `MINIO_*` environment variables; `MINIO_ROOT_USER` and
`MINIO_ROOT_PASSWORD` are therefore fed from `S3_ACCESS_KEY` and `S3_SECRET_KEY` and the backend and
the container always use the same credentials. Only the web console is published
(`SILO_CONSOLE_PORT`, default `9001`), the S3 API stays inside the compose network. `SILO_IMAGE`
exists for environments that cannot pull from Docker Hub: point it at a mirror or at an image you
are allowed to pull without changing the compose file.

Silo needs a few seconds longer to accept connections than a local filesystem, so
`ensureBucket` retries both the bucket check and the bucket creation for about 20 seconds before it
gives up. The bucket is created on startup when `S3_CREATE_BUCKET=true`.

### Own OData implementation

A full OData V4 stack (for example Apache Olingo) adds a large dependency and a large
configuration surface. The service needs read and write access to two entity sets with filtering,
sorting, paging and projection. `ODataFilterParser` (recursive descent), `ODataFilterNode`,
`ODataFilterEvaluator`, `ODataQueryOptions`, `ODataQueryEngine` and `ODataMappings` implement that
subset explicitly:

- The parser only accepts the operators listed in [`odata.md`](odata.md); anything else fails with
  HTTP 400 instead of being silently ignored.
- Filtering and sorting operate on DTO maps in memory after a JPA query, therefore no part of a
  user supplied string is ever concatenated into SQL or JPQL.
- Unpaged queries are bounded by `ODATA_MAX_PAGE_SIZE`, which keeps the memory footprint predictable.

### Roles: two values, first login wins, then owned by the application

The identity provider decides the role of a user the first time the account appears. Afterwards the
stored roles are authoritative and only administrators can change them, which makes the
authorization model independent of claim mapping quirks of a specific IdP. See [`auth.md`](auth.md).

### Cookie security, tokens stay on the server

The backend is both the OAuth client and the JWT resource server. The browser login is a full backend
for frontend: `auth_login_state` and `auth_session` keep the PKCE verifier, the session id hash and the
refresh token in PostgreSQL, while the browser only receives `HttpOnly` cookies. Tokens are validated
against the JWKS of the issuer, the audience list is checked, and roles are mapped to Spring
authorities with the `ROLE_` prefix.

Because the browser authenticates with cookies, CSRF protection is on: `CookieCsrfTokenRepository`
issues `XSRF-TOKEN` and unsafe methods need it as `X-XSRF-TOKEN`. A request with an `Authorization`
header skips that check, which is what keeps command line clients usable without a CORS exception.
`SessionTokenFilter` authenticates the cookie session itself instead of letting the bearer token filter
do it, because a request for which a bearer token can be resolved is exempt from CSRF. CORS itself stays
disabled until `CORS_ALLOWED_ORIGINS` is set. Details are in [`auth.md`](auth.md).

### One session per domain, callback chosen per login

Cookies are scoped to the host, so the two frontends cannot share a session. `AuthSessionService`
therefore derives the public origin from the forwarded headers of the request, selects the callback and
the frontend root of that origin from the configured allowlists and stores the callback in
`auth_login_state`. The token exchange reads that stored value instead of the callback request, so a
login completes on the domain it started on even when the provider answers on another host, and a
forged `Host` header can only choose between allowlisted URIs. The identity provider is served by the
canonical domain only, which keeps one `iss` for both applications.

### Errors

`ApiExceptionHandler` renders every exception as the same JSON document, and the security filter
writes a compact variant of it for 401 and 403. Details are in [`api.md`](api.md).

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
────────────────                      ────────────
state_hash      text PK               id_hash                text PK
redirect_uri    text                  subject               text
code_verifier   text                  client_id             text
expires_at      timestamptz           access_token_expires_at timestamptz
created_at      timestamptz           refresh_token          text nullable
                                       id_token              text nullable
                                       created_at            timestamptz
                                       updated_at            timestamptz
```

`subject` is the stable identifier of the account at the identity provider (`sub` claim). File
content never reaches the database; `storage_key` points to the object storage and `checksum`
stores the SHA-256 of the uploaded bytes.

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

## Scaling notes

- The backend is stateless; horizontal scaling only requires a shared database and bucket.
- Uploads are read fully into memory (`byte[]`), which is fine for the configured 25 MB limit. For
  larger objects use streaming with `RequestBody.fromInputStream` and a multipart upload.
- In-memory OData filtering means that very large collections should be paginated by the client or
  filtered in JPA instead; the current data model does not reach that size.
