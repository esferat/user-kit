# user-kit

Reference implementation of a small but production-shaped web application:

- **Frontends** – two Vite + React 19 + TypeScript applications: `frontend-antd/` with Ant Design 6
  and MobX, `frontend-mui/` with Material UI 7 and Redux Toolkit. Both render the same screens and
  talk to the same backend.
- **Full stack app** – `fullstack-next/`, a Next.js 16 application on its own domain. It is still the
  stock `create-next-app` scaffold; the edge, TLS and compose wiring around it is in place.
- **Backend** – Spring Boot 4.1 / Java 21, a classic REST JSON API (`PageResult{items,total,page,size}`,
  query parameters for search and sorting, `If-Match`/`ETag` for concurrency).
- **Database** – PostgreSQL 17 with Flyway migrations.
- **Object storage** – any S3 compatible storage; the compose file ships Silo.
- **Identity** – OpenID Connect against the Keycloak of the Compose stack, with the backend acting as
  the OAuth client (cookie based, no token in the browser) and a local dev login as an alternative.
- **Edge** – nginx with TLS termination, HTTP → HTTPS redirect and reverse proxying.
- **Logging** – the backend, Keycloak and the nginx edge write log files, Logstash ships them into
  Elasticsearch, Kibana explores them (`ELASTIC_VERSION`, ports `9200` and `5601`).

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
| REST API          | Paged collections via `page`/`size`, search via `search`, sorting via `sort`, concurrency via `If-Match`/`ETag`|
| Administration    | List accounts, change `roles` and `enabled`, reject unsupported roles                                          |
| API documentation | OpenAPI 3 at `/v3/api-docs`, Swagger UI at `/swagger-ui/index.html`                                            |
| Edge              | TLS 1.2/1.3, HSTS, security headers, request size limit, gzip, ACME challenge location                         |
| Logging           | log files of backend, Keycloak and nginx, Logstash pipeline, Elasticsearch indices `user-kit-backend-*`, `user-kit-keycloak-*`, `user-kit-nginx-*`, Kibana at `https://user-kit.kibana.local` |
| Operations        | Health endpoint, structured logs, demo seed data, smoke script, Docker Compose full stack                      |

## Architecture

```
                            ┌──────────────────────────────────────────────┐
   browser  ──────────────► │ edge (nginx, 80 + 443)                       │
                            │  user-kit.local       /       → frontend-antd│
                            │  user-kit.local       /api/, /auth/          │
                            │  user-kit.mui.local   /       → frontend-mui │
                            │  user-kit.next.local  /       → fullstack-next│
                            │  user-kit.kibana.local/       → kibana        │
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

The frontends never talk to the database or the object storage directly; every read and write goes
through the backend, which owns authorization, validation and the mapping from entities to DTOs. The
session cookies are scoped to the host, so each domain keeps its own login; the identity provider
lives on the canonical domain only and the others redirect `/auth` to it.

## Quick start

Requirements: Docker with Compose v2, PowerShell (only for the certificate helper), and a browser.

```bash
git clone <this repository> user-kit
cd user-kit
cp .env.example .env                 # Windows: Copy-Item .env.example .env
pwsh ./scripts/generate-dev-cert.ps1 # creates a self-signed certificate for all domains
docker compose up -d --build
```

The stack serves three applications: `SERVER_NAME` (default `user-kit.local`, Ant Design, canonical),
`SERVER_NAME_MUI` (default `user-kit.mui.local`, Material UI) and `SERVER_NAME_NEXT` (default
`user-kit.next.local`, Next.js). They all talk to the same backend but keep their own sessions,
because the cookies are scoped to the host. `SERVER_NAME_KIBANA` (default `user-kit.kibana.local`)
puts the log UI behind the same TLS edge. Add all names to
`C:\Windows\System32\drivers\etc\hosts` (Windows) or `/etc/hosts` (Linux/macOS):

```
127.0.0.1 user-kit.local user-kit.mui.local user-kit.next.local user-kit.kibana.local
```

Open <https://user-kit.local>, <https://user-kit.mui.local>, <https://user-kit.next.local> or
<https://user-kit.kibana.local> and accept the self-signed certificate. Because the development
certificate is not issued by a trusted CA, every `curl` example in this repository uses `-k`.

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
`VITE_ANTD_THEME`, `VITE_MUI_THEME` and `VITE_DEFAULT_LOCALE`. Setting `DEV_AUTH_ENABLED=false`
removes the local login; the login dialog of Keycloak then is the only way in.

For the local login the backend offers a second method next to the dialog. With `DEV_AUTH_ENABLED=true`
the login page also shows a role button, which calls `POST /api/v1/auth/dev-login` and stores a local
token in a cookie, no password involved.

| URL                                                | Description                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| <https://user-kit.local/>                          | Ant Design application, the canonical domain                               |
| <https://user-kit.mui.local/>                      | Material UI application                                                    |
| <https://user-kit.next.local/>                     | Next.js full stack application                                             |
| <https://user-kit.kibana.local/>                   | Kibana, the log exploration UI of the logging stack                        |
| <https://user-kit.local/auth/>                     | Keycloak, the identity provider of the stack, only on the canonical domain |
| <https://user-kit.local/swagger-ui/index.html>     | Swagger UI                                                                 |
| <https://user-kit.local/healthz>                   | Edge health probe (`ok`)                                                   |
| <https://localhost:8080/healthz>                   | Backend health probe (bypasses nginx)                                      |

Get a token and call the API:

```bash
TOKEN=$(curl -sk -X POST https://user-kit.local/auth/realms/user-kit/protocol/openid-connect/token \
  -d grant_type=password -d client_id=user-kit-web -d username=admin-user -d password=admin \
  -d 'scope=openid profile email' | jq -r .access_token)

curl -sk -H "Authorization: Bearer $TOKEN" https://user-kit.local/api/v1/me
curl -sk -H "Authorization: Bearer $TOKEN" 'https://user-kit.local/api/v1/files?search=report&sort=-createdAt&page=0&size=20'
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
REST search/sort/paging, locking, deletion) run the smoke script; it prints one line per check and
exits with `1` on any deviation:

```bash
pwsh ./scripts/smoke.ps1                # tokens from Keycloak, falls back to the dev issuer
pwsh ./scripts/smoke.ps1 -AuthMode dev  # force the local token issuer
```

### Logs

Logstash tails the application logs of the backend, Keycloak and the nginx edge from shared volumes,
parses them and writes one document per event into Elasticsearch. The backend writes every line in
the format `[level]-[date]- message`, Keycloak logs in its Quarkus file format and nginx logs as
JSON. Every document carries a `service` field (`backend`, `keycloak` or `nginx`) and the parsed
`log.level`, so a single Kibana view can cover all of them.

| Source       | Log file in the container                                                        | Index                 |
| ------------ | -------------------------------------------------------------------------------- | --------------------- |
| backend      | `/var/log/user-kit/backend.log`                                                  | `user-kit-backend-*`  |
| Keycloak     | `/opt/keycloak/data/log/keycloak.log`                                            | `user-kit-keycloak-*` |
| nginx (edge) | `/var/log/user-kit-nginx/access.log` (JSON) and `.../error.log`                  | `user-kit-nginx-*`    |

Open Kibana at <https://user-kit.kibana.local> (or the published <http://localhost:5601>), create the
data views once (see below), then filter by `service`, `log.level`, `message` or time range.

| Service       | URL / access                                                                        |
| ------------- | ----------------------------------------------------------------------------------- |
| Kibana        | <https://user-kit.kibana.local> or <http://localhost:5601>                          |
| Elasticsearch | <http://localhost:9200>                                                             |
| Backend log   | `docker compose exec backend cat /var/log/user-kit/backend.log`                     |
| Keycloak log  | `docker compose exec keycloak cat /opt/keycloak/data/log/keycloak.log`              |
| nginx logs    | `docker compose exec edge cat /var/log/user-kit-nginx/access.log` (and `error.log`) |

First time setup of the Kibana views:

1. Open <https://user-kit.kibana.local>, accept the self-signed certificate and skip the welcome screen.
2. **Stack Management → Data Views → Create data view**.
3. Create one view per source, or a single `user-kit-*` view that covers all of them:

   | Name                | Index pattern         |
   | ------------------- | --------------------- |
   | `user-kit`          | `user-kit-*`          |
   | `user-kit-backend`  | `user-kit-backend-*`  |
   | `user-kit-keycloak` | `user-kit-keycloak-*` |
   | `user-kit-nginx`    | `user-kit-nginx-*`    |

   Set the time field to `@timestamp` for each, then **Save**.
4. Open **Discover** and pick a view. The combined `user-kit` view can be filtered by `service`, the
   per-source views are already scoped. Filter with `log.level` (for example `error`) or search the
   `message` field, and narrow the range in the time picker.

Logstash creates one index per source per day (`user-kit-backend-2026.10.13`); the `user-kit-*`
pattern matches all of them, so the views keep working. If Discover stays empty, check that the
pipeline runs (`docker compose logs logstash`) and that the containers write their log files
(`docker compose exec backend cat /var/log/user-kit/backend.log` and the paths in the table above).

`ELASTIC_VERSION` selects the image tag of all three services (`8.15.3` by default). The dev stack
runs Elasticsearch without TLS and without a password, so a production deployment has to enable its
security. An empty `LOG_FILE` keeps the backend on the console only, for example when the log
collector is not part of the deployment.

## Local development

Run the services from source while keeping PostgreSQL and Silo in Docker:

```bash
docker compose up -d postgres object-storage
```

### Frontend

```bash
cd frontend-antd                # or frontend-mui
npm ci
cp .env.example .env.local      # VITE_API_BASE_URL only, the login lives in the backend
npm run dev                    # frontend-antd: http://localhost:5174
                               # frontend-mui:  http://localhost:5175
```

The dev server proxies `/api` to `http://localhost:8080`, so the browser only talks to one origin. The
login round trip goes through the backend, so `OIDC_CLIENT_REDIRECT_URIS` must contain
`http://localhost:5174/api/v1/auth/callback` (respectively `:5175`) for that setup, otherwise the
provider rejects the redirect after the login form. The proxy keeps the `Origin` header of
`http://localhost:5174`, and the `dev` profile of the backend allows that origin by default through
`app.cors.allowed-origins`. Set `CORS_ALLOWED_ORIGINS` when the proxy points somewhere else.

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
| `npm run check`                           | format:check + lint + typecheck + test                              |

The sources follow [Feature Sliced Design](https://feature-sliced.design) (`src/app`, `src/pages`,
`src/widgets`, `src/features`, `src/entities`, `src/shared`). The Ant Design application keeps its
state in MobX stores, the Material UI application uses Redux Toolkit slices; both are explained in
[docs/frontend.md](docs/frontend.md).

### Full stack Next.js

```bash
cd fullstack-next
corepack enable
pnpm install
pnpm dev                       # http://localhost:3000
```

The Docker image is built from the same folder with `output: "standalone"` and runs `node server.js`.

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

| Variable                                  | Default                                                 | Description                                                                                      |
| ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `SPRING_PROFILES_ACTIVE`                  | `dev`                                                   | `dev` enables SQL logging and the local token issuer                                             |
| `DATABASE_URL`                            | –                                                       | JDBC URL of PostgreSQL                                                                           |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | –                                                       | Database credentials                                                                             |
| `S3_ENDPOINT`                             | `http://localhost:9000`                                 | S3 compatible endpoint                                                                           |
| `S3_REGION`                               | `us-east-1`                                             | Signing region                                                                                   |
| `S3_BUCKET`                               | `user-kit`                                              | Bucket name                                                                                      |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`         | –                                                       | Storage credentials                                                                              |
| `S3_PATH_STYLE`                           | `true`                                                  | Required for most self-hosted storages                                                           |
| `S3_CREATE_BUCKET`                        | `true`                                                  | Create the bucket on startup when it does not exist                                              |
| `FILES_MAX_SIZE_BYTES`                    | `26214400`                                              | Upload limit enforced by the application                                                         |
| `REST_MAX_PAGE_SIZE`                      | `200`                                                   | Upper bound for `size`; a larger value is clamped, not rejected                                  |
| `OIDC_ENABLED`                            | `true`                                                  | Validate incoming tokens against the identity provider                                           |
| `OIDC_ISSUER_URI`                         | `https://user-kit.local/auth/realms/user-kit`           | Expected `iss`, also used for JWKS discovery                                                     |
| `OIDC_JWK_SET_URI`                        | empty                                                   | Optional second URL for the keys when the issuer is not reachable from the backend               |
| `OIDC_AUDIENCES`                          | `user-kit-api`                                          | Accepted `aud` values                                                                            |
| `OIDC_ROLES_CLAIM`                        | `roles`                                                 | Claim that carries the roles                                                                     |
| `DEV_AUTH_ENABLED`                        | `false`                                                 | Expose the local login and `/api/v1/dev/token` (dev profile only)                                |
| `DEV_AUTH_SECRET`                         | dev-only value                                          | HS256 secret of the dev issuer, minimum 32 characters                                            |
| `OIDC_CLIENT_ENABLED`                     | `false`                                                 | Backend performs the browser login as OAuth client                                               |
| `OIDC_REGISTRATION_ENABLED`               | `true`                                                  | Offer `GET /api/v1/auth/register` when the backend is the OAuth client                           |
| `OIDC_CLIENT_ID`                          | empty                                                   | Confidential client id of the realm, for example `user-kit-bff`                                  |
| `OIDC_CLIENT_SECRET`                      | empty                                                   | Secret of that client                                                                            |
| `OIDC_CLIENT_ISSUER_URI`                  | empty                                                   | Optional URL for discovery when the public issuer is not reachable                               |
| `OIDC_CLIENT_REDIRECT_URIS`               | empty                                                   | Comma separated callbacks, one per frontend domain; falls back to the singular variable          |
| `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URIS`   | empty                                                   | Comma separated frontend roots the provider may redirect to; falls back to the singular variable |
| `OIDC_CLIENT_REDIRECT_URI`                | `https://user-kit.local/api/v1/auth/callback`           | Must be registered for the client, used when the lists are empty                                 |
| `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URI`    | `https://user-kit.local/`                               | Where the provider returns after the logout                                                      |
| `OIDC_CLIENT_SCOPES`                      | `openid profile email`                                  | Requested scopes                                                                                 |
| `OIDC_LOGIN_STATE_TTL`                    | `10m`                                                   | How long a started login may take                                                                |
| `OIDC_SESSION_TTL`                        | `12h`                                                   | Lifetime of a session without activity                                                           |
| `OIDC_COOKIE_SECURE`                      | `true`                                                  | `Secure` flag of the session cookies; set `false` for plain HTTP                                 |
| `OIDC_COOKIE_DOMAIN`                      | empty                                                   | Optional cookie domain                                                                           |
| `OIDC_REFRESH_WINDOW`                     | `90s`                                                   | Renew the access token this long before it expires                                               |
| `CORS_ALLOWED_ORIGINS`                    | empty                                                   | Comma separated browser origins; empty keeps the API same origin only                            |
| `CORS_ALLOWED_HEADERS`                    | `Authorization, Content-Type, If-Match, Accept, X-XSRF-TOKEN` | Allowed request headers                                                                   |
| `CORS_EXPOSED_HEADERS`                    | `ETag, Location, Content-Disposition`                   | Headers readable by the browser                                                                  |
| `CORS_MAX_AGE`                            | `30m`                                                   | Preflight cache duration                                                                         |
| `LOG_FILE`                                | empty                                                   | Log file in the `[level]-[date]- message` format; empty keeps the console only                   |
| `ELASTIC_VERSION`                         | `8.15.3`                                                | Image tag of Elasticsearch, Logstash and Kibana                                                  |
| `ELASTICSEARCH_PORT`                      | `9200`                                                  | Host port of the Elasticsearch API                                                               |
| `KIBANA_PORT`                             | `5601`                                                  | Host port of the Kibana UI                                                                       |

### Frontend environment

| Variable              | Default | Description                                          |
| --------------------- | ------- | ---------------------------------------------------- |
| `VITE_API_BASE_URL`   | empty   | Empty means same origin; used for split deployments  |
| `VITE_ANTD_THEME`     | `light` | Ant Design theme alias of the canonical frontend     |
| `VITE_MUI_THEME`      | `light` | Material UI theme alias of the second frontend       |
| `VITE_DEFAULT_LOCALE` | `ru`    | `ru` or `en`, the user can switch the language       |
| `VITE_DEV_ROLE`       | `user`  | Role requested by the local login of the dev profile |

The frontend has no identity provider configuration: the backend reports the available login methods
through `GET /api/v1/auth/config`. Because Vite inlines these variables, a change requires
`docker compose up -d --build frontend-antd frontend-mui`.

## API overview

| Method   | Path                                          | Purpose                                                                |
| -------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/api/v1/me`                                  | Profile and roles of the caller                                        |
| `GET`    | `/api/v1/auth/config`                         | Available login methods (`oidc`, `dev`, `none`) and `registrationEnabled` |
| `GET`    | `/api/v1/auth/login?returnUrl=%23/route`      | Starts the login, answers `302` to the provider                        |
| `GET`    | `/api/v1/auth/register?returnUrl=%23/route`   | Starts the self registration, answers `302` to the provider            |
| `GET`    | `/api/v1/auth/callback`                       | Redirect target of the provider, sets the cookies                      |
| `POST`   | `/api/v1/auth/dev-login`                      | Local login into a cookie, dev profile only, needs CSRF                |
| `POST`   | `/api/v1/auth/logout`                         | Drops the session and ends the provider session, needs CSRF            |
| `GET`    | `/api/v1/dev/token?role=admin\|user`          | Local token issuer for scripts, dev profile only                       |
| `GET`    | `/api/v1/dev/roles`                           | Roles supported by the dev issuer                                      |
| `GET`    | `/api/v1/files?search=&sort=&page=&size=`     | Paged list of visible files                                            |
| `POST`   | `/api/v1/files`                               | `multipart/form-data` upload (`file`, optional `description`)          |
| `GET`    | `/api/v1/files/{id}`                          | Single file, `ETag` in the header and body                             |
| `PATCH`  | `/api/v1/files/{id}`                          | Update `name` and `description`, honours `If-Match`                    |
| `DELETE` | `/api/v1/files/{id}`                          | Delete, honours `If-Match`                                             |
| `GET`    | `/api/v1/files/{id}/content`                  | Binary download                                                        |
| `GET`    | `/api/v1/users?search=&sort=&page=&size=`     | Accounts, `admin` only                                                 |
| `GET`    | `/api/v1/users/{id}`                          | Single account, `admin` only                                           |
| `PATCH`  | `/api/v1/users/{id}`                          | Update `roles` and `enabled`, `admin` only                             |

Errors use one JSON shape:

```json
{
  "timestamp": "2026-01-01T00:00:00Z",
  "status": 412,
  "code": "precondition_failed",
  "message": "The resource was modified by another request",
  "path": "/api/v1/files/6f1c...",
  "violations": []
}
```

Details and examples are in [`docs/api.md`](docs/api.md).

## Tests

```bash
# backend: unit and slice tests, compiled and executed by Maven
docker run --rm -v userkit-m2:/root/.m2 -v "$PWD/backend:/workspace" -w /workspace \
  maven:3.9-eclipse-temurin-21 mvn -B -ntp test

# frontends: lint, formatting, typecheck, unit tests and the production build
cd frontend-antd && npm run check && npm run build
cd ../frontend-mui && npm run check && npm run build
```

## Repository layout

```
user-kit/
├── backend/                Spring Boot service
│   └── src/main/java/com/acme/usermark/
│       ├── common/         page result, error shape, exception handler, patch helpers
│       ├── config/         security, JWT, S3 client, OpenAPI, properties
│       ├── dev/            local token issuer, demo documents
│       ├── file/           file entity, service, storage, REST controller
│       ├── security/       role extraction from JWT claims
│       └── user/           account entity, profile, administration, ETag support
├── frontend-antd/          Vite + React 19 + TypeScript + MobX + Ant Design (canonical)
├── frontend-mui/           Vite + React 19 + TypeScript + Redux Toolkit + Material UI
├── fullstack-next/         Next.js 16 application, standalone output
├── nginx/                  edge template and certificates directory
├── keycloak/realm/         realm import of the local identity provider
├── scripts/                development helper scripts
├── docs/                   detailed documentation
├── docker-compose.yml      full stack
└── .env.example            template for local configuration
```

Both Vite frontends follow Feature Sliced Design inside `src/`:

```
frontend-antd/src/
├── app/            composition root, services, error boundary
├── pages/          documents, login, users
├── widgets/        app shell, documents and users table
├── features/       auth, upload, download, role, theme and locale switch
├── entities/       user and file domain with their REST API calls
└── shared/         http client, configuration, i18n, hooks, format, router, UI
```

## Documentation

| Document                                       | Content                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`docs/api.md`](docs/api.md)                   | REST endpoints, error codes, pagination, concurrency                                    |
| [`docs/architecture.md`](docs/architecture.md) | Runtime topology, components, design decisions                                          |
| [`docs/frontend.md`](docs/frontend.md)         | Feature Sliced Design, state management, API client, auth, theme, i18n, tests           |
| [`docs/deployment.md`](docs/deployment.md)     | Compose stack, TLS, environment reference, production checklist                         |

## Limitations

- The Next.js application is still the default `create-next-app` scaffold; it is served correctly but
  does not implement any screens yet.
- The React frontends run one state library each (MobX in `frontend-antd`, Redux Toolkit in
  `frontend-mui`); there is no single shared UI package, so library specific parts are duplicated.
- The OIDC provider is the local Keycloak of the compose stack; a production setup must point
  `OIDC_ISSUER_URI` and `KEYCLOAK_HOSTNAME` at a real realm.
- The development certificate is self-signed; use a trusted certificate in production.
