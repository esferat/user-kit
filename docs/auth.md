# Authentication and authorization

## Role model

The application knows exactly two roles:

| Role | Spring authority | Capabilities |
| --- | --- | --- |
| `user` | `ROLE_USER` | own files: list, upload, download, delete, rename |
| `admin` | `ROLE_ADMIN` | everything a user can do, plus all files and `/odata/Users` |

`admin` implies full access, so the frontend treats an administrator as a user as well. When roles
are written through `PATCH /odata/Users/{id}` the set is normalized: it must be a non-empty subset
of `{admin, user}` and `admin` is exclusive, so `["admin","user"]` is stored as `["admin"]`.

## Authorization matrix

| Endpoint | Anonymous | `user` | `admin` |
| --- | --- | --- | --- |
| `/healthz`, `/actuator/health`, `/actuator/info` | allowed | allowed | allowed |
| `/v3/api-docs`, `/swagger-ui/**` | allowed | allowed | allowed |
| `/api/v1/dev/**` | allowed when `DEV_AUTH_ENABLED=true` | allowed | allowed |
| `/api/v1/me` | 401 | own profile | own profile |
| `/api/v1/files`, `/api/v1/files/{id}/content` | 401 | own files | all files |
| `/api/v1/files/{id}` (DELETE) | 401 | own files | all files |
| `/odata/$metadata`, `/odata/Files*` | 401 | own files | all files |
| `/odata/Users`, `/odata/Users/{id}` | 401 | 403 | allowed |

Authorization is enforced on the server. The frontend only hides navigation entries for users
without the `admin` role, which is a usability feature and never a security boundary.

## OIDC with the identity provider

The backend is a JWT resource server. When `OIDC_ENABLED=true` and `OIDC_ISSUER_URI` is set, tokens
are validated as follows:

1. The signature is verified with the JWKS of the issuer (fetched from
   `<issuer>/.well-known/openid-configuration`, cached by Spring Security, or from
   `OIDC_JWK_SET_URI` when that variable is set).
2. `iss` must equal `OIDC_ISSUER_URI`, `exp`/`nbf` must be valid.
3. `aud` must contain one of the values in `OIDC_AUDIENCES`.
4. Roles are read from `OIDC_ROLES_CLAIM` and mapped to `ROLE_ADMIN`/`ROLE_USER`.

### Supported claim layouts

`security/RoleClaims` inspects the claims in this order and stops at the first source that carries a
supported role:

| Order | Claim | Example |
| --- | --- | --- |
| 1 | `OIDC_ROLES_CLAIM` | `"roles": ["admin"]` |
| 2 | `roles` | `"roles": ["admin"]` |
| 3 | `groups` | `"groups": ["admin", "sales"]` |
| 4 | `realm_access.roles` | `"realm_access": {"roles": ["admin"]}` |
| 5 | `resource_access.<audience>.roles` | `"resource_access": {"user-kit-api": {"roles": ["admin"]}}` |

The audiences in step 5 are the values of `OIDC_AUDIENCES`, and the roles of every matching audience are
merged in that order. Entries are lower cased and trimmed, unknown values are ignored, and `admin`
collapses to `["admin"]`. A token without any recognised role receives the base `user` role, so a wrong
claim mapping can never lock a user out completely and can never escalate privileges.

`frontend/src/entities/user/model/roles.ts` implements the same order for the UI, so the navigation and the API
agree on the role of the session.

### Provider setup (Keycloak)

Docker compose starts a local Keycloak, so nothing has to be created by hand. The realm comes from
[`keycloak/realm/user-kit-realm.json`](../keycloak/realm/user-kit-realm.json) and is imported on
every start of a fresh container:

| Object | Value |
| --- | --- |
| Realm | `user-kit`, served below `/auth` of the public host |
| Issuer | `https://user-kit.local/auth/realms/user-kit` |
| Client `user-kit-web` | public SPA, Authorization Code + PKCE (`S256`), redirect `https://user-kit.local/*` |
| Client `user-kit-api` | audience of the access token, no interactive login |
| Client scope `user-kit-api-audience` | adds `aud=user-kit-api` to the access token |
| Client scopes `openid`, `profile`, `email`, `roles` | `sub`, name, email and `realm_access.roles` |
| Realm roles | `admin`, `user` |
| Accounts | `admin-user`/`admin` (roles `admin,user`), `user-user`/`user`, `disabled-user`/`disabled` |

`directAccessGrantsEnabled` is on for `user-kit-web` only so that `scripts/smoke.ps1` can fetch
tokens without a browser. Turn it off once the smoke test is not needed anymore; the browser flow
uses PKCE and never sends a password.

Any other provider works as well, for example a corporate IdP. The backend only needs a discovery
document; the frontend only needs the values of `VITE_OIDC_*`. To use one:

1. Create a realm or a tenant, for example `user-kit`.
2. Create a public client for the frontend, for example `user-kit-web`:
   - type: public / SPA,
   - standard flow enabled,
   - redirect URI `https://<host>/`,
   - post logout redirect URI `https://<host>/`,
   - web origin `https://<host>`.
3. Create a client for the backend, for example `user-kit-api`, and put its client id into
   `OIDC_AUDIENCES`. It is only used as the expected audience of incoming tokens.
4. Create the roles `admin` and `user` and assign them to users. Either put the role names into a
   top level claim (Keycloak: protocol mapper "user attribute" or "hardcoded audience" style mappers
   into `roles`), into `realm_access.roles` of the realm, or use client roles that end up in
   `resource_access.<clientId>.roles`. All five layouts are supported.
5. Configure the frontend and the backend:

```bash
# frontend/.env.local
VITE_AUTH_MODE=oidc
VITE_OIDC_AUTHORITY=https://idp.example.com/realms/user-kit
VITE_OIDC_CLIENT_ID=user-kit-web
VITE_OIDC_REDIRECT_URI=https://user-kit.local/
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=https://user-kit.local/
VITE_OIDC_SCOPE=openid profile email

# docker compose environment
OIDC_ENABLED=true
OIDC_ISSUER_URI=https://idp.example.com/realms/user-kit
OIDC_AUDIENCES=user-kit-api
OIDC_ROLES_CLAIM=roles
DEV_AUTH_ENABLED=false
```

The frontend uses Authorization Code + PKCE through `oidc-client-ts` and stores the session in
`sessionStorage`, so no server side session and no client secret exist. Redirect URIs must be
registered exactly, including the trailing slash.

### Split issuer and key location

`OIDC_JWK_SET_URI` is optional and only needed when the issuer URL is not reachable from the
backend. Docker compose uses it, because the public URL is `https://user-kit.local/...` with a self
signed certificate while the container reaches Keycloak over plain HTTP:

```bash
OIDC_ISSUER_URI=https://user-kit.local/auth/realms/user-kit
OIDC_JWK_SET_URI=http://keycloak:8080/auth/realms/user-kit/protocol/openid-connect/certs
```

`iss` is still validated against `OIDC_ISSUER_URI`, only the key lookup is redirected. Without the
variable the backend fetches `<issuer>/.well-known/openid-configuration` itself.

### Hostname configuration of Keycloak

Keycloak builds the issuer from `KC_HOSTNAME`, while the reverse proxy decides which URL the browser
actually uses. Both have to contain the same host and path prefix, otherwise the tokens carry an
issuer that no client can reach:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SERVER_NAME` | `user-kit.local` | public host of the edge container |
| `KEYCLOAK_RELATIVE_PATH` | `/auth` | prefix below `SERVER_NAME` |
| `KEYCLOAK_HOSTNAME` | `https://user-kit.local/auth` | public base URL of Keycloak, **including** the prefix |

When `SERVER_NAME` changes, set `KEYCLOAK_HOSTNAME` accordingly and keep
`OIDC_ISSUER_URI=https://<host><prefix>/realms/user-kit` plus the matching `VITE_OIDC_AUTHORITY`.

## Local development issuer

The local Keycloak of docker compose is the default. For a quick look without a login dialog the
backend can additionally publish a second, local issuer (`user-kit-dev`, HS256) with
`DEV_AUTH_ENABLED=true`:

```bash
curl -sk "https://user-kit.local/api/v1/dev/token?role=admin"
curl -sk "https://user-kit.local/api/v1/dev/token?role=user&subject=jane@example.com"
```

Details:

- Tokens carry `sub`, `preferred_username`, `email`, `name` and `roles`, and live 12 hours.
- `subject` is optional. Without it a random subject is generated, which creates a new account on
  the first call, so the account list grows while experimenting.
- The dev issuer is only registered when the `dev` profile is active. In any other profile the
  endpoints do not exist and `StartupValidator` logs a warning if the secret is still the default.
- `DEV_AUTH_SECRET` must be at least 32 characters; change it for every shared environment.

Never enable the dev issuer in a production deployment: `docker-compose.yml` sets
`SPRING_PROFILES_ACTIVE=dev` for convenience, so override it and set `DEV_AUTH_ENABLED=false`
before exposing the stack. While both issuers are active the resource server accepts a token as soon
as one of them validates it, see `JwtDecoderConfiguration`.

## Account lifecycle

`AuthenticatedUserService` resolves the caller from the `sub` claim:

- Unknown subject: a new `UserAccount` is created with the roles from the token. Username falls back
  to `preferred_username`, then to `sub`, then to a generated value; the email falls back to an
  empty string.
- Known subject: only `email` and `displayName` are refreshed from the token. Roles are **not**
  overwritten, they belong to the application afterwards.
- `enabled = false` blocks every API call for that account, regardless of the token.

The first login decides the initial role, so an IdP must be able to deliver `admin` for at least the
first administrator. Afterwards roles can be maintained through `PATCH /odata/Users/{id}`.

## Frontend behaviour

- `frontend/src/features/auth/oidc/oidcAuthProvider.ts` starts the login, handles the redirect and the logout, and
  exposes the claims of the active session.
- `frontend/src/features/auth/dev/devAuthProvider.ts` calls `/api/v1/dev/token` and keeps the token in memory.
- `frontend/src/entities/user/model/roles.ts` maps claims to the two roles, mirroring the backend, so both sides
  agree on what `admin` means.
- Session expiry triggers a redirect to the identity provider; a failed silent renew falls back to an
  interactive login.
- Access tokens are never written to `localStorage`.

## Hardening checklist

- [ ] `SPRING_PROFILES_ACTIVE` is not `dev` in production.
- [ ] `DEV_AUTH_ENABLED=false` and `DEV_AUTH_SECRET` is not the default value.
- [ ] `OIDC_ISSUER_URI` uses `https://` and matches the token issuer exactly.
- [ ] `OIDC_AUDIENCES` contains the client id of the backend, so tokens minted for other clients of
      the same realm are rejected.
- [ ] `KC_HOSTNAME` of Keycloak matches the URL the browser uses, prefix included.
- [ ] Keycloak runs on its own database instead of `dev-file`, and the realm import directory is
      not mounted in production.
- [ ] Direct access grants of `user-kit-web` are disabled.
- [ ] `CORS_ALLOWED_ORIGINS` lists exactly the origins that need browser access, or stays empty for
      a same origin deployment.
- [ ] `/v3/api-docs` and `/swagger-ui` are restricted at the edge if the contract must stay private.
- [ ] A real TLS certificate is used, see [`deployment.md`](deployment.md).
