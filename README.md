# user-kit

Reference implementation of a small but production-shaped web application:

- **Frontend** – Vite + TypeScript + UI5 Web Components (`sap_horizon` theme).
- **Backend** – Spring Boot 3.5 / Java 21 REST + OData V4 (subset) service.
- **Database** – PostgreSQL 17 with Flyway migrations.
- **Object storage** – any S3 compatible storage; the compose file ships RustFS.
- **Identity** – OpenID Connect against the Keycloak of the Compose stack, with a local dev token issuer as an alternative.
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

| Area | Details |
| --- | --- |
| Authentication | OIDC Authorization Code + PKCE, optional local HS256 dev issuer, JWT resource server on the backend |
| Authorization | Two roles only: `admin` and `user`; every API call is authorized on the server, the frontend only hides UI |
| Files | Upload (`multipart/form-data`), download, delete, SHA-256 checksum, size and type limits, sanitized file names |
| OData | `$metadata`, `$filter`, `$select`, `$orderby`, `$top`, `$skip`, `$count`, concurrency via `If-Match`/`ETag` |
| Administration | List accounts, change `roles` and `enabled`, reject unsupported roles |
| API documentation | OpenAPI 3 at `/v3/api-docs`, Swagger UI at `/swagger-ui/index.html` |
| Edge | TLS 1.2/1.3, HSTS, security headers, request size limit, gzip, ACME challenge location |
| Operations | Health endpoint, structured startup validation, Docker Compose stack with persistent volumes |

## Architecture

```
                    ┌──────────────────────────────────────────┐
   browser  ───────► │ edge (nginx :443/:80)                    │
                    │  /            → frontend (nginx, static) │
                    │  /api/        → backend :8080             │
                    │  /odata/      → backend :8080             │
                    │  /swagger-ui  → backend :8080             │
                    │  /auth/       → keycloak :8080            │
                    └──────┬────────────────┬──────────────────┘
                           │                │
             ┌─────────────▼──────┐   ┌─────▼────────────────────┐
             │ Spring Boot backend│   │ Keycloak :8080           │
             │  security → JWKS   │   │  realm user-kit          │
             │  jpa      → PostgreSQL  │  clients, roles       │
             │  storage  → S3/RustFS   └──────────────────────────┘
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
pwsh ./scripts/generate-dev-cert.ps1 # creates a self-signed certificate for SERVER_NAME
docker compose up -d --build
```

`SERVER_NAME` defaults to `user-kit.local`. Add it to `C:\Windows\System32\drivers\etc\hosts`
(Windows) or `/etc/hosts` (Linux/macOS):

```
127.0.0.1 user-kit.local
```

Open <https://user-kit.local> and accept the self-signed certificate. Because the development
certificate is not issued by a trusted CA, every `curl` example in this repository uses `-k`.

Sign in at the Keycloak login dialog that the application opens:

| Account | Password | Roles |
| --- | --- | --- |
| `admin-user` | `admin` | `admin`, `user` |
| `user-user` | `user` | `user` |

The Keycloak admin console is at <https://user-kit.local/auth/admin/> (`admin`/`admin`) for local
troubleshooting. Both accounts come from
[`keycloak/realm/user-kit-realm.json`](keycloak/realm/user-kit-realm.json), which is imported when
the container starts without a database.

The frontend is configured at build time: Vite inlines the `VITE_*` variables into the bundle and
Compose passes them as build arguments. `.env.example` therefore selects `VITE_AUTH_MODE=oidc`
against the local Keycloak. Switching to `dev` means setting `VITE_AUTH_MODE=dev` and rebuilding with
`docker compose up -d --build frontend`, which skips the login dialog and uses the local token
issuer of the backend.

| URL | Description |
| --- | --- |
| <https://user-kit.local/> | UI5 Web Components application |
| <https://user-kit.local/auth/> | Keycloak, the identity provider of the stack |
| <https://user-kit.local/swagger-ui/index.html> | Swagger UI |
| <https://user-kit.local/healthz> | Edge health probe (`ok`) |
| <https://localhost:8080/healthz> | Backend health probe (bypasses nginx) |

Get a token and call the API:

```bash
TOKEN=$(curl -sk -X POST https://user-kit.local/auth/realms/user-kit/protocol/openid-connect/token \
  -d grant_type=password -d client_id=user-kit-web -d username=admin-user -d password=admin \
  -d 'scope=openid profile email' | jq -r .access_token)

curl -sk -H "Authorization: Bearer $TOKEN" https://user-kit.local/api/v1/me
curl -sk -H "Authorization: Bearer $TOKEN" 'https://user-kit.local/odata/Files?$count=true'
curl -sk -H "Authorization: Bearer $TOKEN" -F "file=@report.pdf" -F "description=Q3 numbers" \
  https://user-kit.local/api/v1/files
```

Shut the stack down with `docker compose down`; add `-v` to delete the PostgreSQL and RustFS volumes.
Keycloak keeps its data inside the container (`dev-file`), so a recreated container starts from the
realm import again.

To verify a running stack end to end (edge, identity provider, roles, upload to the object storage,
OData, locking, deletion) run the smoke script; it prints one line per check and exits with `1` on
any deviation:

```bash
pwsh ./scripts/smoke.ps1                # tokens from Keycloak, falls back to the dev issuer
pwsh ./scripts/smoke.ps1 -AuthMode dev  # force the local token issuer
```

## Local development

Run the services from source while keeping PostgreSQL and RustFS in Docker:

```bash
docker compose up -d postgres object-storage
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env.local     # VITE_AUTH_MODE=dev for the local token issuer
npm run dev                   # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run lint` / `npm run lint:fix` | ESLint 9 flat config, includes the Feature Sliced Design boundaries |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | typecheck + production build into `dist/` |
| `npm test` | Vitest single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage, writes `coverage/lcov.info` |
| `npm run check` | lint + format:check + typecheck + test |

The sources follow [Feature Sliced Design](https://feature-sliced.design) (`src/app`, `src/pages`,
`src/widgets`, `src/features`, `src/entities`, `src/shared`) and the interface is bilingual, Russian
and English, with the language switch in the shell bar. Both are explained in
[docs/frontend.md](docs/frontend.md).

The Vite dev server proxies `/api` and `/odata` to `http://localhost:8080` (see `vite.config.ts`),
so the browser stays on one origin and no CORS configuration is needed. Point the proxy at a
different host, or set `CORS_ALLOWED_ORIGINS`, if the backend does not run on the same machine.

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
export S3_ACCESS_KEY=rustfsadmin
export S3_SECRET_KEY=rustfsadmin
export S3_CREATE_BUCKET=true
export DEV_AUTH_ENABLED=true
export DEV_AUTH_SECRET=dev-only-secret-change-me-0123456789abcdef
```

## Configuration

### Backend environment

| Variable | Default | Description |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | `dev` | `dev` enables SQL logging and the local token issuer |
| `DATABASE_URL` | – | JDBC URL of PostgreSQL |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | – | Database credentials |
| `S3_ENDPOINT` | `http://localhost:9000` | S3 compatible endpoint |
| `S3_REGION` | `us-east-1` | Signing region |
| `S3_BUCKET` | `user-kit` | Bucket name |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | – | Storage credentials |
| `S3_PATH_STYLE` | `true` | Required for most self-hosted storages |
| `S3_CREATE_BUCKET` | `true` | Create the bucket on startup when it does not exist |
| `FILES_MAX_SIZE_BYTES` | `26214400` | Upload limit enforced by the application |
| `OIDC_ENABLED` | `true` | Validate incoming tokens against the identity provider |
| `OIDC_ISSUER_URI` | `https://user-kit.local/auth/realms/user-kit` | Expected `iss`, also used for JWKS discovery |
| `OIDC_JWK_SET_URI` | empty | Optional second URL for the keys when the issuer is not reachable from the backend |
| `OIDC_AUDIENCES` | `user-kit-api` | Accepted `aud` values |
| `OIDC_ROLES_CLAIM` | `roles` | Claim that carries the roles |
| `DEV_AUTH_ENABLED` | `false` | Expose `/api/v1/dev/token` (dev profile only) |
| `DEV_AUTH_SECRET` | dev-only value | HS256 secret of the dev issuer, minimum 32 characters |
| `CORS_ALLOWED_ORIGINS` | empty | Comma separated browser origins; empty keeps the API same origin only |
| `CORS_ALLOWED_HEADERS` | `Authorization, Content-Type, If-Match, Accept` | Allowed request headers |
| `CORS_EXPOSED_HEADERS` | `ETag, Location, Content-Disposition` | Headers readable by the browser |
| `CORS_MAX_AGE` | `30m` | Preflight cache duration |
| `ODATA_DEFAULT_PAGE_SIZE` | `50` | Page size when `$top` is absent |
| `ODATA_MAX_PAGE_SIZE` | `200` | Upper bound for `$top` |

### Frontend environment

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | empty | Empty means same origin; used for split deployments |
| `VITE_AUTH_MODE` | `oidc` | `oidc` or `dev` |
| `VITE_UI5_THEME` | `sap_horizon` | UI5 theme name |
| `VITE_OIDC_AUTHORITY` | `https://user-kit.local/auth/realms/user-kit` | Issuer URL of the identity provider |
| `VITE_OIDC_CLIENT_ID` | `user-kit-web` | Public client id |
| `VITE_OIDC_REDIRECT_URI` | `https://user-kit.local/` | Registered redirect URI |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | `https://user-kit.local/` | Registered post logout URI |
| `VITE_OIDC_SCOPE` | `openid profile email` | Requested scopes |
| `VITE_OIDC_ROLES_CLAIM` | empty | Overrides the claim used for roles |
| `VITE_DEV_ROLE` | `admin` | Role requested from the dev token endpoint |

The Compose stack defaults `VITE_AUTH_MODE` to `oidc` against the local Keycloak. Because Vite
inlines these variables, a change requires `docker compose up -d --build frontend`.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/me` | Profile and roles of the caller |
| `GET` | `/api/v1/dev/token?role=admin\|user` | Local token issuer, dev profile only |
| `GET` | `/api/v1/dev/roles` | Roles supported by the dev issuer |
| `GET` | `/api/v1/files?page=&size=` | REST list of visible files |
| `POST` | `/api/v1/files` | `multipart/form-data` upload (`file`, optional `description`) |
| `GET` | `/api/v1/files/{id}/content` | Binary download |
| `DELETE` | `/api/v1/files/{id}` | Delete, honours `If-Match` |
| `GET` | `/odata/$metadata` | CSDL metadata document |
| `GET` | `/odata/Files` | Query with `$filter`, `$select`, `$orderby`, `$top`, `$skip`, `$count` |
| `GET` | `/odata/Files/{id}` | Single file |
| `GET` | `/odata/Files/{id}/$value` | Binary download as OData media entity |
| `PATCH` | `/odata/Files/{id}` | Update `name` and `description`, honours `If-Match` |
| `DELETE` | `/odata/Files/{id}` | Delete, honours `If-Match` |
| `GET` | `/odata/Users` | Accounts, `admin` only |
| `GET` | `/odata/Users/{id}` | Single account, `admin` only |
| `PATCH` | `/odata/Users/{id}` | Update `roles` and `enabled`, `admin` only |

Errors use one JSON shape:

```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "status": 412,
  "code": "precondition_failed",
  "message": "The resource was modified by another request",
  "path": "/odata/Files/6f1c...",
  "violations": []
}
```

Details and examples are in [`docs/api.md`](docs/api.md) and [`docs/odata.md`](docs/odata.md).

## Tests

```bash
# backend: 73 unit tests (compiled and executed by Maven inside a container)
docker run --rm -v userkit-m2:/root/.m2 -v "$PWD/backend:/workspace" -w /workspace \
  maven:3.9-eclipse-temurin-21 mvn -B -ntp test

# frontend: 158 unit tests plus lint, formatting and the production build
cd frontend && npm run check && npm run build
```

## Repository layout

```
user-kit/
├── backend/                Spring Boot service
│   └── src/main/java/com/acme/usermark/
│       ├── common/         error shape, exception handler, patch helpers
│       ├── config/         security, JWT, S3 client, OpenAPI, properties
│       ├── dev/            local token issuer
│       ├── file/           file entity, service, storage, REST controller
│       ├── odata/          parser, query engine, mappings, controllers
│       ├── security/       role extraction from JWT claims
│       └── user/           account entity, profile, administration
├── frontend/               Vite + TypeScript + UI5 Web Components
│   └── src/                Feature Sliced Design
│       ├── app/            composition root, page registry, startup error
│       ├── pages/          documents, login, users
│       ├── widgets/        app shell, documents and users table
│       ├── features/       auth, upload, download, role, theme and locale switch
│       ├── entities/       user and file domain with their API calls
│       └── shared/         http and OData, configuration, i18n, dom, format, router
├── nginx/                  edge template and certificates directory
├── keycloak/realm/         realm import of the local identity provider
├── scripts/                development helper scripts
├── docs/                   detailed documentation
├── docker-compose.yml      full stack
└── .env.example            template for local configuration
```

## Documentation

| Document | Content |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Components, request flow, decisions and trade-offs |
| [`docs/api.md`](docs/api.md) | REST endpoints, error format, concurrency |
| [`docs/odata.md`](docs/odata.md) | Supported OData subset, parser rules, limitations |
| [`docs/auth.md`](docs/auth.md) | Keycloak setup, role model, dev issuer, authorization matrix |
| [`docs/frontend.md`](docs/frontend.md) | UI5 Web Components integration, FSD structure, localization, routing, linting |
| [`docs/deployment.md`](docs/deployment.md) | TLS, Compose reference, production checklist |

## Limitations

- The OData implementation covers a documented subset; `$expand`, `$search`, `$apply`, `$batch` and
  change sets are rejected with HTTP 400. Filtering and sorting happen in memory after the JPA query.
- The UI uses UI5 Web Components instead of XML views. The official SAPUI5 toolchain is
  [UI5 CLI](https://ui5.github.io/cli/v4) based and cannot be reproduced with a plain Vite build.
- The generated TLS certificate is self-signed. Production deployments must supply a certificate
  from a trusted CA; see [`docs/deployment.md`](docs/deployment.md).
- Role names are fixed to `admin` and `user`.
- Dev tokens create a new local account per request, so the account list grows while using
  `/api/v1/dev/token`.
