# user-kit

Reference implementation of a small but production-shaped web application:

- **Frontend** – Vite + React 19 + TypeScript + MobX + Ant Design/Material UI (`sap_horizon` theme).
- **Backend** – Spring Boot 3.5 / Java 21 REST + REST JSON API (subset) service.
- **Database** – PostgreSQL 17 with Flyway migrations.
- **Object storage** – any S3 compatible storage; the compose file ships Silo.
- **Identity** – OpenID Connect against the Keycloak of the Compose stack, with the backend acting as the OAuth client (cookie based, no token in the browser) and a local dev login as an alternative.
- **Edge** – nginx with TLS termination, HTTP → HTTPS redirect and reverse proxying.

The application manages **file objects**: authenticated users upload files, list and download them,
administrators additionally manage all files and the role assignment of all accounts.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Local development](#local-development)
- [Configuration](#configuration)
- [API overview](#api-overview)
- [Tests](#tests)
- [Repository layout](#repository-layout)
- [Documentation](#documentation)
- [Limitations](#limitations)

---

## Features

| Area              | Details                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Authentication    | OIDC Authorization Code + PKCE, optional local HS256 dev issuer, JWT resource server on the backend            |
| Authorization     | Two roles only: `admin` and `user`; every API call is authorized on the server, the frontend only hides UI     |
| Files             | Upload (`multipart/form-data`), download, delete, SHA-256 checksum, size and type limits, sanitized file names |
| OData             | `$metadata`, `$filter`, `$select`, `$orderby`, `$top`, `$skip`, `$count`, concurrency via `If-Match`/`ETag`    |
| Administration    | List accounts, change `roles` and `enabled`, reject unsupported roles                                          |
| API documentation | OpenAPI 3 at `/v3/api-docs`, Swagger UI at `/swagger-ui/index.html`                                            |
| Edge              | TLS 1.2/1.3, HSTS, security headers, request size limit, gzip, ACME challenge location                         |
| Operations        | Health endpoint, structured startup validation, Docker Compose stack with persistent volumes                   |

## Architecture

```
                    ┌──────────────────────────────────────────┐
   browser  ───────► │ edge (nginx :443/:80)                    │
                    │  /            → frontend (nginx, static) │
                    │  /api/        → backend :8080             │
                    │  REST API      → backend :8080             │
                    │  /swagger-ui  → backend :8080             │
                    │  /auth/       → keycloak :8080            │
                    └──────┬────────────────┬──────────────────┘
                           │                │
             ┌─────────────▼──────┐   ┌─────▼────────────────────┐
             │ Spring Boot backend│   │ Keycloak :8080           │
             │  security → JWKS   │   │  realm user-kit          │
             │  jpa      → PostgreSQL  │  clients, roles       │
             │  storage  → S3/Silo     └──────────────────────────┘
             └────────────────────┘
```

The frontend never talks to the database or the object storage directly; every read and write goes
through the backend, which owns authorization, validation and the mapping from entities to DTOs.

## Quick start

Requirements: Docker with Compose v2, PowerShell (only for the certificate helper), and a browser.

```bash
git clone <this repository> user-kit
cd user-kit
cp .env.example .env                 # Windows: Copy-Item .env.example .env
pwsh ./scripts/generate-dev-cert.ps1 # creates a self-signed certificate for all three domains
docker compose up -d --build
```

The stack serves three independent applications: `SERVER_NAME` (default `user-kit.local`, UI5),
`SERVER_NAME_ALT` (default `user-kit.local`, Ant Design) and `SERVER_NAME_MUI` (default
`user-kit.mui.local`, Material UI). They all talk to the same backend but keep their own sessions,
because the cookies are scoped to the host. Add all three names to
`C:\Windows\System32\drivers\etc\hosts` (Windows) or `/etc/hosts` (Linux/macOS):

```
127.0.0.1 user-kit.local user-kit.local user-kit.mui.local
```

Open <https://user-kit.local>, <https://user-kit.local> or <https://user-kit.mui.local> and
accept the self-signed certificate. Because the development certificate is not issued by a trusted CA,
every `curl` example in this repository uses `-k`.

Sign in at the Keycloak login dialog that the application opens:

| Account      | Password | Roles           |
| ------------ | -------- | --------------- |
| `admin-user` | `admin`  | `admin`, `user` |
| `user-user`  | `user`   | `user`          |

The Keycloak admin console is at <https://user-kit.local/auth/admin/> (`admin`/`admin`) for local
troubleshooting. Both accounts come from
[`keycloak/realm/user-kit-realm.json`](keycloak/realm/user-kit-realm.json), which is imported when
the container starts without a database.

The backend is the OAuth client: it exchanges the authorization code, keeps the refresh token in the
database and hands the browser two httpOnly cookies. The frontend bundle contains no identity
provider configuration and no token, which is why the login has no mode to choose. A login always
returns to the domain it started on: the backend picks the callback of that origin from
`OIDC_CLIENT_REDIRECT_URIS` and stores it in the login state, so the token exchange sends the same
`redirect_uri` the provider saw. What the bundle does carry is configured at build time: Vite inlines
the `VITE_*` variables into the bundle and Compose passes them as build arguments, for example
`VITE_UI5_THEME`, `VITE_ANTD_THEME`, `VITE_MUI_THEME` and `VITE_DEFAULT_LOCALE`. Setting `DEV_AUTH_ENABLED=false`
removes the local login; the login dialog of Keycloak then is the only way in.

For the local login the backend offers a second method next to the dialog. With `DEV_AUTH_ENABLED=true`
the login page also shows a role button, which calls `POST /api/v1/auth/dev-login` and stores a local
token in a cookie, no password involved.

| URL                                                | Description                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| <https://user-kit.local/>                      | Ant Design/Material UI application, the canonical domain                       |
| <https://user-kit.local/>                      | Ant Design application, the second domain                                  |
| <https://user-kit.mui.local/>                      | Material UI application, the third domain                                  |
| <https://user-kit.local/auth/>                 | Keycloak, the identity provider of the stack, only on the canonical domain |
| <https://user-kit.local/swagger-ui/index.html> | Swagger UI                                                                 |
| <https://user-kit.local/healthz>               | Edge health probe (`ok`)                                                   |
| <https://localhost:8080/healthz>                   | Backend health probe (bypasses nginx)                                      |

Get a token and call the API:

```bash
TOKEN=$(curl -sk -X POST https://user-kit.local/auth/realms/user-kit/protocol/openid-connect/token \
  -d grant_type=password -d client_id=user-kit-web -d username=admin-user -d password=admin \
  -d 'scope=openid profile email' | jq -r .access_token)

curl -sk -H "Authorization: Bearer $TOKEN" https://user-kit.local/api/v1/me
curl -sk -H "Authorization: Bearer $TOKEN" 'https://user-kit.localREST APIFiles?$count=true'
curl -sk -H "Authorization: Bearer $TOKEN" -F "file=@report.pdf" -F "description=Q3 numbers" \
  https://user-kit.local/api/v1/files
```

Shut the stack down with `docker compose down`; add `-v` to delete the PostgreSQL and Silo volumes.
Keycloak keeps its data inside the container (`dev-file`), so a recreated container starts from the
realm import again.

### Demo documents

With the `dev` profile the backend fills an **empty** store with eight sample documents: two PDF, two
CSV, two Markdown and two plain text files, owned by the local account `demo`. The seeder runs once
per empty store, so a restart with existing documents changes nothing; delete the documents in the UI
to get them again. `DEMO_DATA_ENABLED=false` starts the backend without them. Outside the `dev`
profile the seeder is not even registered, which the wiring test of `DemoDataSeederWiringTest`
guarantees.

To verify a running stack end to end (edge, identity provider, roles, upload to the object storage,
OData, locking, deletion) run the smoke script; it prints one line per check and exits with `1` on
any deviation:

```bash
pwsh ./scripts/smoke.ps1                # tokens from Keycloak, falls back to the dev issuer
pwsh ./scripts/smoke.ps1 -AuthMode dev  # force the local token issuer
```

## Local development

Run the services from source while keeping PostgreSQL and Silo in Docker:

```bash
docker compose up -d postgres object-storage
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local     # VITE_API_BASE_URL only, the login lives in the backend
npm run dev                   # http://localhost:5173
```

The dev server serves the SPA on `http://localhost:5173` while the backend runs on `8080`. The login
round trip goes through the backend, so `OIDC_CLIENT_REDIRECT_URI` must contain
`http://localhost:5173/api/v1/auth/callback` in that setup, otherwise the provider rejects the
redirect after the login form.

| Script                                    | Purpose                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                             | Vite dev server with hot reload                                     |
| `npm run lint` / `npm run lint:fix`       | ESLint 9 flat config, includes the Feature Sliced Design boundaries |
| `npm run format` / `npm run format:check` | Prettier                                                            |
| `npm run typecheck`                       | `tsc --noEmit`                                                      |
| `npm run build`                           | typecheck + production build into `dist/`                           |
| `npm test`                                | Vitest single run                                                   |
| `npm run test:watch`                      | Vitest in watch mode                                                |
| `npm run test:coverage`                   | Vitest with V8 coverage, writes `coverage/lcov.info`                |
| `npm run check`                           | lint + format:check + typecheck + test                              |

The sources follow [Feature Sliced Design](https://feature-sliced.design) (`src/app`, `src/pages`,
`src/widgets`, `src/features`, `src/entities`, `src/shared`), the state lives in MobX stores, one per
concern, and the interface is bilingual, Russian
and English, with the language switch in the shell bar. Both are explained in
[docs/frontend.md](docs/frontend.md).

The Vite dev server proxies `/api` and `/odata` to `http://localhost:8080` (see `vite.config.ts`),
so the browser only talks to one origin. The proxy keeps the `Origin` header of
`http://localhost:5173`, and the `dev` profile of the backend allows that origin by default
through `app.cors.allowed-origins`. Set `CORS_ALLOWED_ORIGINS` when the proxy points somewhere else.

### Backend

Java 21 and Maven 3.9+ are required for local runs. Without them the Maven image is used:

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

Required environment for a local process (see `application.yml` for the full list):

```bash
export DATABASE_URL=jdbc:postgresql://localhost:5432/userkit
export DATABASE_USERNAME=userkit
export DATABASE_PASSWORD=userkit
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=siloadmin
export S3_SECRET_KEY=siloadmin
export S3_CREATE_BUCKET=true
export DEV_AUTH_ENABLED=true
export DEV_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef
```

## Configuration

### Backend environment

| Variable                                  | Default                                                       | Description                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `SPRING_PROFILES_ACTIVE`                  | `dev`                                                         | `dev` enables SQL logging and the local token issuer                                             |
| `DATABASE_URL`                            | –                                                             | JDBC URL of PostgreSQL                                                                           |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | –                                                             | Database credentials                                                                             |
| `S3_ENDPOINT`                             | `http://localhost:9000`                                       | S3 compatible endpoint                                                                           |
| `S3_REGION`                               | `us-east-1`                                                   | Signing region                                                                                   |
| `S3_BUCKET`                               | `user-kit`                                                    | Bucket name                                                                                      |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`         | –                                                             | Storage credentials                                                                              |
| `S3_PATH_STYLE`                           | `true`                                                        | Required for most self-hosted storages                                                           |
| `S3_CREATE_BUCKET`                        | `true`                                                        | Create the bucket on startup when it does not exist                                              |
| `FILES_MAX_SIZE_BYTES`                    | `26214400`                                                    | Upload limit enforced by the application                                                         |
| `OIDC_ENABLED`                            | `true`                                                        | Validate incoming tokens against the identity provider                                           |
| `OIDC_ISSUER_URI`                         | `https://user-kit.local/auth/realms/user-kit`             | Expected `iss`, also used for JWKS discovery                                                     |
| `OIDC_JWK_SET_URI`                        | empty                                                         | Optional second URL for the keys when the issuer is not reachable from the backend               |
| `OIDC_AUDIENCES`                          | `user-kit-api`                                                | Accepted `aud` values                                                                            |
| `OIDC_ROLES_CLAIM`                        | `roles`                                                       | Claim that carries the roles                                                                     |
| `DEV_AUTH_ENABLED`                        | `false`                                                       | Expose the local login and `/api/v1/dev/token` (dev profile only)                                |
| `DEV_AUTH_SECRET`                         | dev-only value                                                | HS256 secret of the dev issuer, minimum 32 characters                                            |
| `OIDC_CLIENT_ENABLED`                     | `false`                                                       | Backend performs the browser login as OAuth client                                               |
| `OIDC_CLIENT_ID`                          | empty                                                         | Confidential client id of the realm, for example `user-kit-bff`                                  |
| `OIDC_CLIENT_SECRET`                      | empty                                                         | Secret of that client                                                                            |
| `OIDC_CLIENT_ISSUER_URI`                  | empty                                                         | Optional URL for discovery when the public issuer is not reachable                               |
| `OIDC_CLIENT_REDIRECT_URIS`               | empty                                                         | Comma separated callbacks, one per frontend domain; falls back to the singular variable          |
| `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URIS`   | empty                                                         | Comma separated frontend roots the provider may redirect to; falls back to the singular variable |
| `OIDC_CLIENT_REDIRECT_URI`                | `https://user-kit.local/api/v1/auth/callback`             | Must be registered for the client, used when the lists are empty                                 |
| `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URI`    | `https://user-kit.local/`                                 | Where the provider returns after the logout                                                      |
| `OIDC_CLIENT_SCOPES`                      | `openid profile email`                                        | Requested scopes                                                                                 |
| `OIDC_LOGIN_STATE_TTL`                    | `10m`                                                         | How long a started login may take                                                                |
| `OIDC_SESSION_TTL`                        | `12h`                                                         | Lifetime of a session without activity                                                           |
| `OIDC_COOKIE_SECURE`                      | `true`                                                        | `Secure` flag of the session cookies; set `false` for plain HTTP                                 |
| `OIDC_COOKIE_DOMAIN`                      | empty                                                         | Optional cookie domain                                                                           |
| `OIDC_REFRESH_WINDOW`                     | `90s`                                                         | Renew the access token this long before it expires                                               |
| `CORS_ALLOWED_ORIGINS`                    | empty                                                         | Comma separated browser origins; empty keeps the API same origin only                            |
| `CORS_ALLOWED_HEADERS`                    | `Authorization, Content-Type, If-Match, Accept, X-XSRF-TOKEN` | Allowed request headers                                                                          |
| `CORS_EXPOSED_HEADERS`                    | `ETag, Location, Content-Disposition`                         | Headers readable by the browser                                                                  |
| `CORS_MAX_AGE`                            | `30m`                                                         | Preflight cache duration                                                                         |
| `ODATA_DEFAULT_PAGE_SIZE`                 | `50`                                                          | Page size when `$top` is absent                                                                  |
| `ODATA_MAX_PAGE_SIZE`                     | `200`                                                         | Upper bound for `$top`                                                                           |

### Frontend environment

| Variable              | Default       | Description                                          |
| --------------------- | ------------- | ---------------------------------------------------- |
| `VITE_API_BASE_URL`   | empty         | Empty means same origin; used for split deployments  |
| `VITE_UI5_THEME`      | `sap_horizon` | UI5 theme name                                       |
| `VITE_ANTD_THEME`     | `light`       | Ant Design theme alias of the second frontend        |
| `VITE_MUI_THEME`      | `light`       | Material UI theme alias of the third frontend        |
| `VITE_DEFAULT_LOCALE` | `ru`          | `ru` or `en`, the user can switch the language       |
| `VITE_DEV_ROLE`       | `user`        | Role requested by the local login of the dev profile |

The frontend has no identity provider configuration: the backend reports the available login methods
through `GET /api/v1/auth/config`. Because Vite inlines these variables, a change requires
`docker compose up -d --build frontend frontend-antd frontend-mui`.

## API overview

| Method   | Path                                     | Purpose                                                                |
| -------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/api/v1/me`                             | Profile and roles of the caller                                        |
| `GET`    | `/api/v1/auth/config`                    | Available login methods: `oidc`, `dev` or `none`                       |
| `GET`    | `/api/v1/auth/login?returnUrl=%23/route` | Starts the login, answers `302` to the provider                        |
| `GET`    | `/api/v1/auth/callback`                  | Redirect target of the provider, sets the cookies                      |
| `POST`   | `/api/v1/auth/dev-login`                 | Local login into a cookie, dev profile only, needs CSRF                |
| `POST`   | `/api/v1/auth/logout`                    | Drops the session and ends the provider session, needs CSRF            |
| `GET`    | `/api/v1/dev/token?role=admin\|user`     | Local token issuer for scripts, dev profile only                       |
| `GET`    | `/api/v1/dev/roles`                      | Roles supported by the dev issuer                                      |
| `GET`    | `/api/v1/files?page=&size=`              | REST list of visible files                                             |
| `POST`   | `/api/v1/files`                          | `multipart/form-data` upload (`file`, optional `description`)          |
| `GET`    | `/api/v1/files/{id}/content`             | Binary download                                                        |
| `DELETE` | `/api/v1/files/{id}`                     | Delete, honours `If-Match`                                             |
| `GET`    | `REST API$metadata`                       | CSDL metadata document                                                 |
| `GET`    | `REST APIFiles`                           | Query with `$filter`, `$select`, `$orderby`, `$top`, `$skip`, `$count` |
| `GET`    | `REST APIFiles/{id}`                      | Single file                                                            |
| `GET`    | `REST APIFiles/{id}/$value`               | Binary download as OData media entity                                  |
| `PATCH`  | `REST APIFiles/{id}`                      | Update `name` and `description`, honours `If-Match`                    |
| `DELETE` | `REST APIFiles/{id}`                      | Delete, honours `If-Match`                                             |
| `GET`    | `REST APIUsers`                           | Accounts, `admin` only                                                 |
| `GET`    | `REST APIUsers/{id}`                      | Single account, `admin` only                                           |
| `PATCH`  | `REST APIUsers/{id}`                      | Update `roles` and `enabled`, `admin` only                             |

Errors use one JSON shape:

```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "status": 412,
  "code": "precondition_failed",
  "message": "The resource was modified by another request",
  "path": "REST APIFiles/6f1c...",
  "violations": []
}
```

Details and examples are in [`docs/api.md`](docs/api.md) and [`docs/odata.md`](docs/odata.md).

## Tests

```bash
# backend: 150 unit tests (compiled and executed by Maven inside a container)
docker run --rm -v userkit-m2:/root/.m2 -v "$PWD/backend:/workspace" -w /workspace \
  maven:3.9-eclipse-temurin-21 mvn -B -ntp test

# frontend: 316 (UI5), 306 (Ant Design) and 290 (Material UI) unit tests plus lint,
# formatting and the production build
cd frontend && npm run check && npm run build
cd ../frontend-antd && npm run check && npm run build
cd ../frontend-mui && npm run check && npm run build
```

## Repository layout

```
user-kit/
├── backend/                Spring Boot service
│   └── src/main/java/com/acme/usermark/
│       ├── common/         error shape, exception handler, patch helpers
│       ├── config/         security, JWT, S3 client, OpenAPI, properties
│       ├── dev/            local token issuer, demo documents
│       ├── file/           file entity, service, storage, REST controller
│       ├── odata/          parser, query engine, mappings, controllers
│       ├── security/       role extraction from JWT claims
│       └── user/           account entity, profile, administration
├── frontend/               Vite + React 19 + TypeScript + Ant Design/Material UI
│   └── src/                Feature Sliced Design
│       ├── app/            composition root, services, error boundary
│       ├── pages/          documents, login, users
│       ├── widgets/        app shell, documents and users table
│       ├── features/       auth, upload, download, role, theme and locale switch
│       ├── entities/       user and file domain with their API calls
│       └── shared/         http and OData, configuration, i18n, hooks, format, router, UI
├── frontend-antd/          second frontend, Vite + React 19 + TypeScript + MobX + Ant Design
├── frontend-mui/           third frontend, Vite + React 19 + TypeScript + Redux Toolkit + Material UI
├── nginx/                  edge template and certificates directory
├── keycloak/realm/         realm import of the local identity provider
├── scripts/                development helper scripts
├── docs/                   detailed documentation
├── docker-compose.yml      full stack
└── .env.example            template for local configuration
```

## Documentation

| Document                                       | Content                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md) | Components, request flow, decisions and trade-offs                                      |
| [`docs/api.md`](docs/api.md)                   | REST endpoints, error format, concurrency                                               |
| [`docs/odata.md`](docs/odata.md)               | Supported OData subset, parser rules, limitations                                       |
| [`docs/auth.md`](docs/auth.md)                 | Keycloak setup, role model, dev issuer, authorization matrix                            |
| [`docs/frontend.md`](docs/frontend.md)         | React and Ant Design/Material UI integration, FSD structure, localization, routing, linting |
| [`docs/deployment.md`](docs/deployment.md)     | TLS, Compose reference, two-domain setup, production checklist                          |

## Limitations

- The OData implementation covers a documented subset; `$expand`, `$search`, `$apply`, `$batch` and
  change sets are rejected with HTTP 400. Filtering and sorting happen in memory after the JPA query.
- The UI is React 19 on Ant Design/Material UI instead of XML views. The official SAPUI5 toolchain is
  [UI5 CLI](https://ui5.github.io/cli/v4) based and cannot be reproduced with a plain Vite build.
- The generated TLS certificate is self-signed. Production deployments must supply a certificate
  from a trusted CA; see [`docs/deployment.md`](docs/deployment.md).
- Role names are fixed to `admin` and `user`.
- Dev tokens create a new local account per request, so the account list grows while using
  `/api/v1/dev/token`.
