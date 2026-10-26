# Architecture

This document describes how the components fit together, which decisions were taken and why.

## Runtime topology

```
                            ┌──────────────────────────────────────────────┐
   browser  ──────────────► │ edge (nginx, 80 + 443)                       │
                            │  user-kit.local       /       → next:3000    │
                            │  user-kit.local       /api/   → backend:8080 │
                            │  user-kit.local       /auth/  → keycloak     │
                            │  user-kit.local       /profile-api/ → profile│
                            │  user-kit.next.local  /       → next:3000    │
                            │  user-kit.next.local  /auth/  → 308 canonical│
                            │  user-kit.profile.local/      → profile:3001 │
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

`frontend-main/` implements the screens of the application on top of the REST API (Ant Design
components). It is served by the edge on two domains: the canonical one and its own. All domains talk
to the same backend but keep their own cookie session, because the cookies are scoped to the host. The
identity
provider lives on the canonical domain only, so the other domain redirects `/auth` to it and every
application sees the same `iss`.

The profile editor is the exception: it lives in `user-profile/`, a separate application on
`SERVER_NAME_PROFILE` with its own BFF (`/profile-api/`). The edge proxies that prefix on the
canonical domain too, so the component, rendered inside `frontend-main`, keeps its calls same origin
where the session cookie lives. `SERVER_NAME_KIBANA` is not an application: the edge proxies it to the
Kibana container of the logging stack, so the log UI shares the TLS edge of the applications.

## Layers

| Layer       | Where                                                        | Responsibility                                                        |
| ----------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Edge        | `nginx/templates`                                            | TLS termination, proxy, security headers, host routing                |
| Frontend    | `frontend-main/`                                            | UI, state, session, API calls, served by the edge on both domains     |
| API         | `backend/.../adapters/in/web`                                | REST controllers, DTO mapping, error shape                            |
| Application | `backend/.../application`                                    | Use cases, transactions, validation, orchestration of the ports       |
| Domain      | `backend/.../domain`                                         | Aggregates, rules, ports (repositories, storage, identity provider)   |
| Adapters    | `backend/.../adapters/out`                                   | JPA rows and repositories, S3 storage, OpenID Connect client          |
| Identity    | `backend/.../adapters/in/security`, `keycloak/realm`         | JWT resource server, cookies, session filter, realm import            |

The backend follows the hexagonal architecture: the domain is in the centre, the use cases around it
depend only on the ports it declares, and the adapters implement those ports. The dependencies always
point inwards:

```
   adapters/in/web ─┐                        ┌─ adapters/out/persistence (JPA)
   adapters/in/sec ─┼─► application ─► domain ┼─ adapters/out/storage (S3)
   adapters/dev ────┘      (use cases)  (ports)└─ adapters/out/identity (OIDC)
```

`domain/` does not import Spring, JPA, Jackson or the servlet API at all: the aggregates (`Account`,
`FileObject`, `AuthSession`, `LoginState`), the ports (`AccountRepository`, `FileRepository`,
`FileStorage`, `SessionRepository`, `LoginStateRepository`, `IdentityProvider`) and the value objects
(`DomainException`, `Etag`, `PageResult`, `FileUpload`, `Caller`) are plain Java. The application layer
uses the ports and owns the transactions; the only framework annotations it carries are
`@Transactional` and the transaction synchronization of the avatar cleanup, because a transaction
boundary has to span several ports (the object storage and the database). The adapters translate
between the world of the domain and the world of the framework: JPA rows, multipart uploads, JSON
DTOs, cookies, JWT claims.

The boundary of the application layer is described in DTOs: the web adapter hands over commands and
the caller, the use cases answer with DTOs. The aggregates never leave the application layer.

### Packages by responsibility

Every layer is packaged by the zone of responsibility it serves, and the zones are named the same
way in every layer: `file`, `profile`, `account`, `auth` and `dev`.

| Zone      | Domain            | Application                       | Web adapter                    | Persistence                       |
| --------- | ----------------- | --------------------------------- | ------------------------------ | --------------------------------- |
| `file`    | `FileObject`      | `FileUseCases`, `FileDto`         | `web/file`                     | `persistence/file`                |
| `profile` | —                 | `ProfileUseCases`, `ProfileDto`   | `web/profile`                  | —                                 |
| `account` | `Account`         | `AccountAdminUseCases`, `AccountDto` | `web/account`                | `persistence/account`             |
| `auth`    | `AuthSession`     | `AuthenticationUseCases`          | `web/auth`, `in/security`      | `persistence/auth`                |
| `dev`     | —                 | —                                 | `web/dev`, `out/dev`           | —                                 |

So the model of a zone, its use case, its controller and its adapter sit next to each other by name,
while the layers keep their dependency direction. The cross-zone references are explicit and few: the
file zone needs the owner row of the account zone, and the profile zone needs the account.


## Key decisions

### One React application on two domains

`frontend-main/` is the only frontend: a Next.js application with Ant Design screens, served by the
edge both on the canonical domain and on its own domain. Two host names are kept because the
identity provider, the canonical domain and the application domain are separate concerns in the
deployment story; the cookie sessions stay host scoped, so a login on one domain does not leak to the
other.

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

Search and sorting are implemented in the web adapter against typed values; no user supplied string
is concatenated into SQL or JPQL.

### DTOs at the use case boundary

The use cases are the boundary of the application layer, and the boundary speaks DTOs:

- **Input:** the web adapter builds a command (`UploadFileCommand`, `UpdateFileCommand`,
  `UpdateProfileCommand`, `UpdateAccountCommand`) or passes the caller (`CallerContext` with the id, the
  email and the admin flag). A command field that is `null` stays untouched.
- **Output:** the use cases answer with a DTO (`FileDto`, `AccountDto`, `ProfileDto`), never with an
  aggregate. The DTO is the JSON of the API, so the web adapter only serializes it.

The aggregates of the domain (`Account`, `FileObject`, `AuthSession`, `LoginState`) stay inside the
application layer: no controller, no filter and no DTO holds one. That solves three problems at once:

- No lazy association is touched after the transaction closed (`spring.jpa.open-in-view` is disabled
  deliberately, so such a failure surfaces as HTTP 500 instead of a hidden extra query).
- Optimistic locking is flushed before the response is built, so the returned `ETag` already contains
  the new version number.
- The JSON contract is described in one place — the DTO — and the domain may change without touching
  it.

`spring.jpa.open-in-view: false` plus explicit `join fetch` queries in the repositories guarantees
that every read which needs the owner has it loaded. `FileObjectRow.owner` is additionally mapped as
`FetchType.EAGER`, so a detached owner can no longer turn into a `LazyInitializationException` when a
file leaves the adapter.

The persistence adapter has its own DTOs: the JPA rows (`UserAccountRow`, `FileObjectRow`, …) are the
data transfer objects of the storage, the mappers translate them into the aggregates and back.

### Errors: the domain names the failure, the adapter names the status

The domain throws `DomainException` with a `Kind` (`VALIDATION`, `NOT_FOUND`, `FORBIDDEN`,
`UNAUTHENTICATED`, `CONFLICT`, `PRECONDITION_FAILED`, `PAYLOAD_TOO_LARGE`, `UPSTREAM`) and a stable
machine readable code. The web adapter maps the kind onto the status of the response
(`400/404/403/401/409/412/413/502`) in `ApiExceptionHandler`, so the domain does not know HTTP and the
JSON contract stays exactly as it was. The same code and the same message are used everywhere, the
frontends and the smoke script rely on them.


### Object storage: Silo in compose, S3 everywhere else

`S3FileStorage` speaks plain S3 with the AWS SDK v2, so Silo, AWS S3, Ceph or Garage only need the
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

`SessionTokenFilter` refreshes the access token when it is about to expire; `Etag` maps the JPA
`@Version` to a weak `W/"<version>"` ETag and verifies `If-Match` on PATCH and DELETE.

## Data model

```
user_account                            file_object
────────────                            ───────────
id                   uuid  PK           id            uuid  PK
subject              text unique        name          text
username             text               description   text nullable
email                text               content_type  text
display_name         text               size_bytes    bigint
roles                text[]             checksum      text nullable
enabled              boolean            storage_key   text unique
avatar_key           text               owner_id      uuid FK -> user_account
avatar_thumbnail_key text               version       bigint
avatar_content_type  text               created_at    timestamptz
avatar_updated_at    timestamptz        updated_at    timestamptz
profile_overridden   boolean
created_at           timestamptz
updated_at           timestamptz
version              bigint

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

The avatar lives in the same storage, under `avatars/<account-id>/<upload-id>/full.png` and
`.../thumbnail.png`. Both are re-encoded PNG squares of 512×512 and 64×64, so neither the format of
the upload nor the metadata of the original survives. `profile_overridden` flips on the first
successful `PATCH /api/v1/me`; from then on the identity provider no longer overwrites the display
name and the email of the account.

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
4. `CallerResolver` reads the principal out of the security context, `CurrentAccountService`
   loads or creates the `Account` of `sub` and reduces it to the `CallerContext`.
5. `FileUseCases.upload` takes the `UploadFileCommand`, validates name, size and content type,
   computes the checksum and the `files/2026/10/<uuid>/report.pdf` key.
6. `S3FileStorage.put` writes the object, `FileRepository.save` stores the metadata and the use case
   answers with the `FileDto` that carries the `ETag: W/"0"`.
7. If the database insert fails afterwards, the object is deleted again so that no orphan remains.

## Observability

The backend logs one line per event in the format `[level]-[date]- message` and, when `LOG_FILE` is
set, mirrors the stream into a file of the `backend-logs` volume. Keycloak (`KC_LOG=console,file`)
writes its Quarkus file log into `keycloak-logs`, the edge writes a JSON access log and a plain error
log into `nginx-logs`. Logstash tails those files, parses each format with its own grok or `json`
filter, folds Java stack traces onto their first line with the multiline codec and indexes the events,
tagged with a `service` field, into the `user-kit-backend-<date>`, `user-kit-keycloak-<date>` and
`user-kit-nginx-<date>` indices of Elasticsearch. Kibana reads the indices behind the edge proxy on
`SERVER_NAME_KIBANA`, so the pipeline never touches the request path: a slow or down log collector
cannot slow the API down, and the console output of `docker compose logs backend` stays the single
source of truth for a local run.

## Scaling notes

- The backend is stateless; horizontal scaling only requires a shared database and bucket.
- Uploads are read fully into memory (`byte[]`), which is fine for the configured 25 MB limit. For
  larger objects use streaming with `RequestBody.fromInputStream` and a multipart upload.
- Search, sorting and paging run against the database with a bounded page size, so the hot path stays
  predictable as the collections grow.
