# Deployment

## Compose stack

```bash
cp .env.example .env
pwsh ./scripts/generate-dev-cert.ps1     # or bring your own certificate
docker compose up -d --build
docker compose ps
```

| Service | Image | Ports | Purpose |
| --- | --- | --- | --- |
| `edge` | `nginx:1.27-alpine` | 80, 443 | TLS termination, reverse proxy, headers |
| `frontend` | built from `frontend/` | internal 80 | static UI5 assets |
| `backend` | built from `backend/` | 8080 | REST and OData service |
| `keycloak` | `quay.io/keycloak/keycloak:26.4` | 8180, internal 8080 | identity provider, realm `user-kit` |
| `postgres` | `postgres:17-alpine` | internal 5432 | database with Flyway migrations |
| `object-storage` | `rustfs/rustfs:latest` | internal 9000 | S3 compatible file storage |

Volumes `postgres-data` and `object-storage-data` keep the state across restarts. `docker compose
down -v` deletes them. Keycloak uses `dev-file`, so its data lives inside the container and a
recreated container imports `keycloak/realm/user-kit-realm.json` again.

Health checks: PostgreSQL uses `pg_isready`, Keycloak queries `/auth/health/ready` on its management
port, the backend calls `/actuator/health` and waits up to 45 seconds for the first start, the
frontend checks its index page. The backend therefore only starts after PostgreSQL and Keycloak are
healthy, and it retries the bucket check for 20 seconds so the storage may start in parallel.

## TLS

`edge` reads `/etc/nginx/certs/server.crt` and `/etc/nginx/certs/server.key`, which are mounted from
the host directory `nginx/certs` (read only). TLS 1.2 and 1.3 are enabled, HSTS is sent with
`max-age=31536000`, and port 80 answers the ACME challenge location and redirects everything else to
HTTPS with 308.

### Development certificate

```bash
pwsh ./scripts/generate-dev-cert.ps1                 # uses SERVER_NAME or user-kit.local
pwsh ./scripts/generate-dev-cert.ps1 -Domain app.local -Days 30
```

The script runs `alpine/openssl` in Docker, so no OpenSSL installation is needed. The certificate
contains `subjectAltName` entries for the domain, `localhost` and `127.0.0.1`. It is self signed,
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

| Variable | Default | Purpose |
| --- | --- | --- |
| `SERVER_NAME` | `user-kit.local` | `server_name` of both nginx servers |
| `HTTP_PORT` / `HTTPS_PORT` | `80` / `443` | published ports of the edge |
| `MAX_UPLOAD_SIZE` | `26m` | nginx `client_max_body_size` |
| `DATABASE_NAME` / `DATABASE_USERNAME` / `DATABASE_PASSWORD` | `userkit` | PostgreSQL |
| `S3_BUCKET` | `user-kit` | bucket name |
| `S3_REGION` | `us-east-1` | signing region |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `rustfsadmin` | storage credentials, change them |
| `S3_CREATE_BUCKET` | `true` | create the bucket on startup |
| `SPRING_PROFILES_ACTIVE` | `dev` | set to something else in production |
| `BACKEND_PORT` | `8080` | published backend port, remove the mapping for edge only access |
| `OIDC_ENABLED` | `true` | validate tokens against the identity provider |
| `OIDC_ISSUER_URI` | `https://user-kit.local/auth/realms/user-kit` | expected `iss`, also used for JWKS discovery |
| `OIDC_JWK_SET_URI` | `http://keycloak:8080/...` | optional second URL for the keys, keep it while the issuer is not reachable from the backend |
| `OIDC_AUDIENCES` | `user-kit-api` | accepted audiences |
| `OIDC_ROLES_CLAIM` | `roles` | claim that carries the roles |
| `DEV_AUTH_ENABLED` | `true` | local token issuer, set to `false` in production |
| `DEV_AUTH_SECRET` | dev-only value | HS256 secret, change it |
| `KEYCLOAK_VERSION` | `26.4` | image tag of the identity provider |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | `admin` | bootstrap admin of the container, change them |
| `KEYCLOAK_PORT` | `8180` | published port that bypasses the edge |
| `KEYCLOAK_RELATIVE_PATH` | `/auth` | prefix below `SERVER_NAME`, forwarded by the edge |
| `KEYCLOAK_HOSTNAME` | `https://user-kit.local/auth` | public base URL of Keycloak, must match `SERVER_NAME` plus the prefix |
| `VITE_AUTH_MODE` | `oidc` | build argument, `dev` skips the login dialog |
| `VITE_DEV_ROLE` | `admin` | build argument, role used in `dev` mode |
| `VITE_UI5_THEME` | `sap_horizon` | build argument, initial theme before the user switches it |
| `VITE_DEFAULT_LOCALE` | `ru` | build argument, `ru` or `en`; the user can switch the language |
| `VITE_OIDC_AUTHORITY` | `https://user-kit.local/auth/realms/user-kit` | build arguments for `oidc` mode |
| `VITE_OIDC_CLIENT_ID` | `user-kit-web` | public client of the realm |
| `VITE_OIDC_REDIRECT_URI` / `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | `https://user-kit.local/` | build arguments, must match the registered URIs |

The `VITE_*` variables are build time configuration: Vite inlines them into the bundle and Compose
forwards them as build arguments to the `frontend` image. A change therefore needs
`docker compose up -d --build frontend`, not a restart. For an `oidc` deployment set
`VITE_AUTH_MODE=oidc` together with `VITE_OIDC_AUTHORITY`, `VITE_OIDC_REDIRECT_URI` and
`VITE_OIDC_POST_LOGOUT_REDIRECT_URI`; a bundle built without them renders a configuration error
instead of the login page.

Backend only settings are documented in the README, for example `FILES_MAX_SIZE_BYTES`,
`CORS_ALLOWED_ORIGINS` and `ODATA_MAX_PAGE_SIZE`.

## Production checklist

- [ ] `SERVER_NAME` points to a real host and DNS resolves to the edge container.
- [ ] A trusted TLS certificate is mounted, `ssl_stapling` is enabled if the issuer supports OCSP.
- [ ] `SPRING_PROFILES_ACTIVE` is not `dev`, `DEV_AUTH_ENABLED=false`, `DEV_AUTH_SECRET` is random.
- [ ] `DATABASE_PASSWORD`, `S3_SECRET_KEY` and `OIDC_ISSUER_URI` are set for the real environment.
- [ ] `VITE_AUTH_MODE=oidc` together with `VITE_OIDC_*` is baked into the frontend image, because
      `docker compose up -d` without `--build` would reuse the old bundle.
- [ ] `OIDC_AUDIENCES` contains the backend client id, so tokens of other clients are rejected.
- [ ] Keycloak uses a real database instead of `dev-file`, the realm import directory is not
      mounted, and direct access grants of `user-kit-web` are disabled.
- [ ] `KEYCLOAK_HOSTNAME`, `OIDC_ISSUER_URI` and `VITE_OIDC_AUTHORITY` describe the same public URL,
      including the `/auth` prefix.
- [ ] `BACKEND_PORT` mapping is removed if only nginx should reach the backend.
- [ ] `/v3/api-docs` and `/swagger-ui` are blocked at the edge if the contract must stay private.
- [ ] Database and bucket backups are configured; both contain state that cannot be recreated.
- [ ] Log shipping and alerting for HTTP 5xx are in place.
- [ ] `docker compose pull` and `docker compose up -d` run in the release pipeline, images are
      rebuilt with `--build` for frontend and backend.

## Scaling and operations

- The backend is stateless: scale with `docker compose up -d --scale backend=3` after removing the
  `BACKEND_PORT` mapping, behind a load balancer that terminates TLS. No session state exists, all
  tokens are verified per request.
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
pwsh ./scripts/smoke.ps1                                   # SERVER_NAME or user-kit.local
pwsh ./scripts/smoke.ps1 -ServerName app.local
pwsh ./scripts/smoke.ps1 -SkipCertificateCheck             # only with a trusted certificate
pwsh ./scripts/smoke.ps1 -AuthMode oidc                    # tokens from the identity provider
pwsh ./scripts/smoke.ps1 -AuthMode dev                      # tokens from /api/v1/dev/token
pwsh ./scripts/smoke.ps1 -ExpectAuthMode oidc              # assert the deployed SPA bundle
pwsh ./scripts/smoke.ps1 -Realm user-kit -AdminUser jane   # other realm or accounts
```

The default `-AuthMode auto` fetches tokens from the local Keycloak and falls back to the dev token
issuer when no discovery document is reachable. The `oidc` mode checks the issuer of the realm, the
`aud` value and the roles of both tokens, and verifies that a wrong password and a disabled account
are rejected. Direct access grants must be enabled on the client for this, which is the case for
`user-kit-web` of the shipped realm.

The script also inspects the deployed SPA bundle, because Vite inlines the `VITE_*` variables at build
time: it verifies that the bundle carries the configured OIDC authority. Add `-ExpectAuthMode dev|oidc`
to assert one specific mode in a deployment pipeline.

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
