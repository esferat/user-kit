# Deployment

## Compose stack

```bash
cp .env.example .env
pwsh ./scripts/generate-dev-cert.ps1     # or bring your own certificate
docker compose up -d --build
docker compose ps
```

| Service          | Image                                       | Ports                       | Purpose                                                                      |
| ---------------- | ------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `edge`           | `nginx:1.27-alpine`                         | 80, 443                     | TLS termination, reverse proxy, headers, the host names of all three domains |
| `frontend`       | built from `frontend/`                      | internal 80                 | static UI5 assets, canonical domain                                          |
| `frontend-antd`  | built from `frontend-antd/`                 | internal 80                 | static Ant Design assets, second domain                                      |
| `frontend-mui`   | built from `frontend-mui/`                  | internal 80                 | static Material UI assets, third domain                                      |
| `backend`        | built from `backend/`                       | 8080                        | REST and OData service                                                       |
| `keycloak`       | `quay.io/keycloak/keycloak:26.4`            | 8180, internal 8080         | identity provider, realm `user-kit`                                          |
| `postgres`       | `postgres:17-alpine`                        | internal 5432               | database with Flyway migrations                                              |
| `object-storage` | `${SILO_IMAGE:-pgsty/silo}:${SILO_VERSION}` | console 9001, internal 9000 | S3 compatible file storage                                                   |

Volumes `postgres-data` and `object-storage-data` keep the state across restarts. `docker compose
down -v` deletes them. Keycloak uses `dev-file`, so its data lives inside the container and a
recreated container imports `keycloak/realm/user-kit-realm.json` again.

Health checks: PostgreSQL uses `pg_isready`, Keycloak queries `/auth/health/ready` on its management
port, Silo queries `/minio/health/live` (Silo keeps the reserved routes of the MinIO server), the
backend calls `/actuator/health` and waits up to 45
seconds for the first start, the frontend checks its index page. The backend therefore only starts
after PostgreSQL and Keycloak are healthy, and it retries the bucket check and creation for 20
seconds so the storage may start in parallel.

## TLS

`edge` reads `/etc/nginx/certs/server.crt` and `/etc/nginx/certs/server.key`, which are mounted from
the host directory `nginx/certs` (read only). TLS 1.2 and 1.3 are enabled, HSTS is sent with
`max-age=31536000`, and port 80 answers the ACME challenge location and redirects everything else to
HTTPS with 308.

### Development certificate

```bash
pwsh ./scripts/generate-dev-cert.ps1                 # uses SERVER_NAME, SERVER_NAME_ALT and SERVER_NAME_MUI
pwsh ./scripts/generate-dev-cert.ps1 -Domain app.local -AltDomain app2.local -MuiDomain app3.local -Days 30
```

The script runs `alpine/openssl` in Docker, so no OpenSSL installation is needed. The certificate
contains `subjectAltName` entries for all three domains, `localhost` and `127.0.0.1`. It is self signed,
therefore every browser and every `curl` call needs `-k` or a manual exception, and it is ignored by
the Java trust store of a real client.

### Production certificate

Replace both files with the certificate and the private key of a trusted CA, for example from
Let's Encrypt, and make sure the key is readable by the container user:

```bash
cp fullchain.pem nginx/certs/server.crt
cp privkey.pem   nginx/certs/server.key
docker compose restart edge
openssl x509 -in nginx/certs/server.crt -noout -subject -dates -issuer
```

`nginx/certs/*` is ignored by git, so keys never reach the repository. For Let's Encrypt with the
included challenge location, mount the webroot of the certificate client into
`/var/www/certbot` and use `--webroot -w /var/www/certbot`.

## Environment reference

### Compose (`.env`)

| Variable                                                    | Default                                                  | Purpose                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `SERVER_NAME`                                               | `user-kit.local`                                     | canonical `server_name`, hosts the first frontend and `/auth`                                |
| `SERVER_NAME_ALT`                                           | `user-kit.local`                                     | `server_name` of the second frontend, `/auth` redirects to the canonical domain              |
| `SERVER_NAME_MUI`                                           | `user-kit.mui.local`                                     | `server_name` of the third frontend, `/auth` redirects to the canonical domain               |
| `HTTP_PORT` / `HTTPS_PORT`                                  | `80` / `443`                                             | published ports of the edge                                                                  |
| `MAX_UPLOAD_SIZE`                                           | `26m`                                                    | nginx `client_max_body_size`                                                                 |
| `DATABASE_NAME` / `DATABASE_USERNAME` / `DATABASE_PASSWORD` | `userkit`                                                | PostgreSQL                                                                                   |
| `S3_BUCKET`                                                 | `user-kit`                                               | bucket name                                                                                  |
| `S3_REGION`                                                 | `us-east-1`                                              | signing region                                                                               |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`                           | `siloadmin`                                              | storage credentials, also used as `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, change them       |
| `S3_CREATE_BUCKET`                                          | `true`                                                   | create the bucket on startup                                                                 |
| `SILO_VERSION`                                              | `latest`                                                 | image tag of the object storage                                                              |
| `SILO_IMAGE`                                                | `pgsty/silo`                                             | image of the object storage, set it to a mirror when Docker Hub is not reachable             |
| `SILO_CONSOLE_PORT`                                         | `9001`                                                   | published port of the Silo console, the S3 API stays internal                                |
| `SPRING_PROFILES_ACTIVE`                                    | `dev`                                                    | set to something else in production                                                          |
| `DEMO_DATA_ENABLED`                                         | `true`                                                   | fill an empty store with sample documents, dev profile only                                  |
| `BACKEND_PORT`                                              | `8080`                                                   | published backend port, remove the mapping for edge only access                              |
| `OIDC_ENABLED`                                              | `true`                                                   | validate tokens against the identity provider                                                |
| `OIDC_ISSUER_URI`                                           | `https://user-kit.local/auth/realms/user-kit`        | expected `iss`, also used for JWKS discovery                                                 |
| `OIDC_JWK_SET_URI`                                          | `http://keycloak:8080/...`                               | optional second URL for the keys, keep it while the issuer is not reachable from the backend |
| `OIDC_AUDIENCES`                                            | `user-kit-api`                                           | accepted audiences                                                                           |
| `OIDC_ROLES_CLAIM`                                          | `roles`                                                  | claim that carries the roles                                                                 |
| `DEV_AUTH_ENABLED`                                          | `true`                                                   | local token issuer, set to `false` in production                                             |
| `DEV_AUTH_SECRET`                                           | dev-only value                                           | HS256 secret, change it                                                                      |
| `KEYCLOAK_VERSION`                                          | `26.4`                                                   | image tag of the identity provider                                                           |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`                | `admin`                                                  | bootstrap admin of the container, change them                                                |
| `KEYCLOAK_PORT`                                             | `8180`                                                   | published port that bypasses the edge                                                        |
| `KEYCLOAK_RELATIVE_PATH`                                    | `/auth`                                                  | prefix below `SERVER_NAME`, forwarded by the edge                                            |
| `KEYCLOAK_HOSTNAME`                                         | `https://user-kit.local/auth`                        | public base URL of Keycloak, must match `SERVER_NAME` plus the prefix                        |
| `OIDC_CLIENT_ENABLED`                                       | `true`                                                   | backend acts as the OAuth client of the browser login                                        |
| `OIDC_CLIENT_ID`                                            | `user-kit-bff`                                           | confidential client of the realm                                                             |
| `OIDC_CLIENT_SECRET`                                        | dev-only value                                           | client secret, change it for production                                                      |
| `OIDC_CLIENT_ISSUER_URI`                                    | `http://keycloak:8080/auth/realms/user-kit`              | URL used for discovery, keep it while the public issuer is not reachable from the backend    |
| `OIDC_CLIENT_REDIRECT_URIS`                                 | the callbacks of all three domains, comma separated      | one entry per frontend domain, must be registered for the client                             |
| `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URIS`                     | the frontend roots of all three domains, comma separated | where the provider may return after the logout                                               |
| `OIDC_CLIENT_REDIRECT_URI`                                  | `https://user-kit.local/api/v1/auth/callback`        | fallback of the callback list                                                                |
| `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URI`                      | `https://user-kit.local/`                            | fallback of the post logout list                                                             |
| `OIDC_CLIENT_SCOPES`                                        | `openid profile email`                                   | requested scopes                                                                             |
| `OIDC_LOGIN_STATE_TTL`                                      | `10m`                                                    | how long a started login may take                                                            |
| `OIDC_SESSION_TTL`                                          | `12h`                                                    | lifetime of a session without activity                                                       |
| `OIDC_COOKIE_SECURE`                                        | `false`                                                  | set to `true` for every HTTPS deployment                                                     |
| `OIDC_COOKIE_DOMAIN`                                        | empty                                                    | optional cookie domain, empty scopes them to the host                                        |
| `OIDC_REFRESH_WINDOW`                                       | `90s`                                                    | renew the access token this long before it expires                                           |
| `VITE_DEV_ROLE`                                             | `admin`                                                  | build argument, role used by the local dev login                                             |
| `VITE_UI5_THEME`                                            | `sap_horizon`                                            | build argument, initial theme before the user switches it                                    |
| `VITE_ANTD_THEME`                                           | `light`                                                  | build argument of the second frontend                                                        |
| `VITE_MUI_THEME`                                            | `light`                                                  | build argument of the third frontend                                                         |
| `VITE_DEFAULT_LOCALE`                                       | `ru`                                                     | build argument, `ru` or `en`; the user can switch the language                               |

The `VITE_*` variables are build time configuration: Vite inlines them into the bundle and Compose
forwards them as build arguments to the `frontend`, `frontend-antd` and `frontend-mui` images. A change
therefore needs `docker compose up -d --build frontend frontend-antd frontend-mui`, not a restart.
Identity provider settings are no longer part of the bundle: the backend owns the login and reports the
available methods through `/api/v1/auth/config`, so a provider change is a restart of the backend.

Backend only settings are documented in the README, for example `FILES_MAX_SIZE_BYTES`,
`CORS_ALLOWED_ORIGINS` and `ODATA_MAX_PAGE_SIZE`.

## Production checklist

- [ ] `SERVER_NAME` points to a real host and DNS resolves to the edge container;
      `SERVER_NAME_ALT` and `SERVER_NAME_MUI` do the same for the other frontends.
- [ ] A trusted TLS certificate is mounted and covers all three names, `ssl_stapling` is enabled if the
      issuer supports OCSP.
- [ ] `SPRING_PROFILES_ACTIVE` is not `dev`, `DEV_AUTH_ENABLED=false`, `DEV_AUTH_SECRET` is random.
- [ ] `DATABASE_PASSWORD`, `S3_SECRET_KEY` and `OIDC_ISSUER_URI` are set for the real environment.
- [ ] `OIDC_CLIENT_SECRET` is the production secret of the `user-kit-bff` client, not the value of the
      shipped realm.
- [ ] `OIDC_COOKIE_SECURE=true`, because the session and access token cookies are then HTTPS only.
- [ ] `OIDC_CLIENT_REDIRECT_URIS` and `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URIS` are registered for the
      client, one entry per served domain.
- [ ] `OIDC_AUDIENCES` contains the backend client id, so tokens of other clients are rejected.
- [ ] Keycloak uses a real database instead of `dev-file`, the realm import directory is not
      mounted, and direct access grants of `user-kit-web` and `user-kit-bff` are disabled.
- [ ] `KEYCLOAK_HOSTNAME` and `OIDC_ISSUER_URI` describe the same public URL, including the `/auth`
      prefix.
- [ ] `BACKEND_PORT` mapping is removed if only nginx should reach the backend.
- [ ] `/v3/api-docs` and `/swagger-ui` are blocked at the edge if the contract must stay private.
- [ ] Database and bucket backups are configured; both contain state that cannot be recreated.
- [ ] Log shipping and alerting for HTTP 5xx are in place.
- [ ] `docker compose pull` and `docker compose up -d` run in the release pipeline, images are
      rebuilt with `--build` for frontend and backend.

## Scaling and operations

- The backend keeps no session state in memory: scale with `docker compose up -d --scale backend=3`
  after removing the `BACKEND_PORT` mapping, behind a load balancer that terminates TLS. Browser
  sessions and refresh tokens live in PostgreSQL, so any instance can serve any request.
- `auth_session` and `auth_login_state` grow until the next login cleans them up. Schedule a
  `DELETE FROM auth_session WHERE updated_at < now() - interval '12 hours'` and
  `DELETE FROM auth_login_state WHERE expires_at < now()` for a deployment with few logins.
- Uploads are buffered in memory up to `FILES_MAX_SIZE_BYTES` (25 MB default). For larger objects
  switch to streaming and multipart uploads.
- OData filtering runs in memory after the JPA query. If a collection grows beyond a few thousand
  rows, move the hot filters into JPA specifications.
- Database migrations run automatically through Flyway on startup. Keep `db/migration` backward
  compatible for the duration of a rolling update.

## End to end check

`scripts/smoke.ps1` verifies a running stack: TLS edge, SPA, OpenAPI, discovery document of the
identity provider, the roles of the tokens, authentication, authorization, upload into the object
storage, download through both endpoints, the supported OData query options, rejected OData input,
optimistic locking, role administration and deletion. It prints one line per check and exits with `1`
if anything deviates from the expected status.

```bash
pwsh ./scripts/smoke.ps1                                   # SERVER_NAME, SERVER_NAME_ALT, SERVER_NAME_MUI
pwsh ./scripts/smoke.ps1 -ServerName app.local
pwsh ./scripts/smoke.ps1 -AltServerName app2.local          # second domain, must exist
pwsh ./scripts/smoke.ps1 -MuiServerName app3.local          # third domain, must exist
pwsh ./scripts/smoke.ps1 -SkipCertificateCheck             # only with a trusted certificate
pwsh ./scripts/smoke.ps1 -AuthMode oidc                    # tokens from the identity provider
pwsh ./scripts/smoke.ps1 -AuthMode dev                      # tokens from /api/v1/dev/token
pwsh ./scripts/smoke.ps1 -Realm user-kit -AdminUser jane   # other realm or accounts
```

The default `-AuthMode auto` fetches tokens from the local Keycloak and falls back to the dev token
issuer when no discovery document is reachable. The `oidc` mode checks the issuer of the realm, the
`aud` value and the roles of both tokens, and verifies that a wrong password and a disabled account
are rejected. Direct access grants must be enabled on the client for this, which is the case for
`user-kit-web` of the shipped realm.

The script also checks the cookie login: `/api/v1/auth/config` has to report the expected mode,
`/api/v1/auth/login` has to redirect to the provider and an unsafe call without a CSRF token has to
be rejected with `403`. It finally inspects the deployed SPA bundle to confirm that no identity
provider configuration and no OIDC client library leaked into it.

The last block runs against the second and third domain: each serves its own SPA and the same API,
`/auth` has to redirect to the canonical domain, and a login of that domain has to announce the callback
of that domain, never the one of another one. Pass an empty `-AltServerName` and `-MuiServerName` only
after removing the second and third server blocks from the edge template.

## Useful commands

```bash
docker compose config                     # validate the resolved configuration
docker compose logs -f backend            # follow the application log
docker compose exec postgres psql -U userkit -d userkit
docker compose exec backend sh            # shell inside the JRE image
docker compose up -d --build backend      # rebuild and restart a single service
docker compose down                       # stop, keep the volumes
docker compose down -v                    # stop and delete the volumes
```
