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
| `/api/v1/auth/config`, `/api/v1/auth/login`, `/api/v1/auth/callback` | allowed | allowed | allowed |
| `/api/v1/auth/dev-login`, `/api/v1/auth/logout` | allowed with a CSRF token | allowed | allowed |
| `/api/v1/me` | 401 | own profile | own profile |
| `/api/v1/files`, `/api/v1/files/{id}/content` | 401 | own files | all files |
| `/api/v1/files/{id}` (DELETE) | 401 | own files | all files |
| `/odata/$metadata`, `/odata/Files*` | 401 | own files | all files |
| `/odata/Users`, `/odata/Users/{id}` | 401 | 403 | allowed |

Authorization is enforced on the server. The frontend only hides navigation entries for users
without the `admin` role, which is a usability feature and never a security boundary.

## Browser login: backend for frontend

The backend is both the OAuth client and the JWT resource server. The browser never performs an
authorization code flow on its own, no identity provider library runs in the frontend bundle and no
token is readable by JavaScript:

1. `GET /api/v1/auth/config` tells the frontend which methods exist: `oidc`, `dev` or `none`.
2. `GET /api/v1/auth/login` stores a hashed `state` and a PKCE `code_verifier` in `auth_login_state`
   and answers `302` to the authorization endpoint of the provider. `?returnUrl=%23/documents` keeps
   the router route after the round trip; only a local fragment is accepted, everything else falls
   back to the default page.
3. The provider sends the browser to `GET /api/v1/auth/callback`. The backend consumes the state,
   exchanges the code with its client secret over HTTP basic and stores the refresh token in
   `auth_session`, keyed by the SHA-256 hash of a random session id.
4. The callback sets the session cookies and redirects to the application:

   | Cookie | Contents | Lifetime |
   | --- | --- | --- |
   | `UK_SESSION` | session id, only its hash is stored | `OIDC_SESSION_TTL` |
   | `UK_TOKEN` | current access token, read back by the backend on every request | until the token expires |
   | `UK_DEV_TOKEN` | local dev token, dev profile only | `DEV_AUTH_TOKEN_TTL` |

   All three are `HttpOnly`, `Path=/`, `SameSite=Lax`, and `Secure` when `OIDC_COOKIE_SECURE=true`.

`SessionTokenFilter` authenticates the request from those cookies: when the access token expires within
`OIDC_REFRESH_WINDOW`, the refresh token from the database buys a new one first, so a long session
survives without an interactive login. A refresh that the provider rejects ends the session and clears
the cookies.

The filter deliberately does not hand the token to the bearer token filter. Spring Security exempts
every request from CSRF as soon as the bearer token resolver finds a token, and a cookie the browser
attaches on its own would hand that exemption to every request of the session. `CookieAwareBearerTokenResolver`
therefore reads the `Authorization` header and the dev token cookie only.

`POST /api/v1/auth/logout` deletes the session row, revokes the refresh token and returns the URL that
ends the session of the provider, which is why the next login shows the credentials form again.

### CSRF

Cookies are sent by the browser automatically, therefore every unsafe method needs the CSRF token.
`CookieCsrfTokenRepository` issues `XSRF-TOKEN` (readable by JavaScript, `HttpOnly` off) and the
frontend echoes it as `X-XSRF-TOKEN` for `POST`, `PATCH` and `DELETE`. The token stays stable while the
browser keeps it, because the authentication of a request does not replace it.

A request with an `Authorization` header skips the check, because that header cannot be attached by
another origin without a successful CORS preflight; this is what keeps `curl` and CLI clients usable.
The same holds for the `UK_DEV_TOKEN` cookie of the dev profile: the local login issues a bearer token,
so CSRF is not exercised there. Only the identity provider flow of a deployed environment relies on it.

### Command line clients

`Authorization: Bearer <token>` works and takes precedence over the cookie of a browser, so existing
scripts and tests need no change.

## Token validation

When `OIDC_ENABLED=true` and `OIDC_ISSUER_URI` is set, tokens are validated as follows:

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
| Client `user-kit-bff` | confidential, the backend performs Authorization Code + PKCE (`S256`), redirects `/api/v1/auth/callback` |
| Client `user-kit-web` | legacy public client, no longer used by the frontend |
| Client `user-kit-api` | audience of the access token, no interactive login |
| Client scope `user-kit-api-audience` | adds `aud=user-kit-api` to the access token |
| Client scopes `openid`, `profile`, `email`, `roles` | `sub`, name, email and `realm_access.roles` |
| Realm roles | `admin`, `user` |
| Accounts | `admin-user`/`admin` (roles `admin,user`), `user-user`/`user`, `disabled-user`/`disabled` |

`directAccessGrantsEnabled` is on for `user-kit-web` only so that `scripts/smoke.ps1` can fetch
tokens without a browser. Turn it off once the smoke test is not needed anymore; the browser flow
uses PKCE and never sends a password.

Any other provider works as well, for example a corporate IdP. Only the backend needs configuration
now, the frontend asks `/api/v1/auth/config` what it can use. To use one:

1. Create a realm or a tenant, for example `user-kit`.
2. Create a confidential client, for example `user-kit-bff`:
   - type: confidential, client authentication on,
   - standard flow enabled,
   - valid redirect URI `https://<host>/api/v1/auth/callback`,
   - post logout redirect URI `https://<host>/`,
   - web origin `https://<host>` (the dev flow is not used for this client).
3. Create a client for the audience, for example `user-kit-api`, and put its client id into
   `OIDC_AUDIENCES`. It is only used as the expected audience of incoming tokens.
4. Create the roles `admin` and `user` and assign them to users. Either put the role names into a
   top level claim (Keycloak: protocol mapper "user attribute" or "hardcoded audience" style mappers
   into `roles`), into `realm_access.roles` of the realm, or use client roles that end up in
   `resource_access.<clientId>.roles`. All five layouts are supported.
5. Configure the backend:

```bash
OIDC_ENABLED=true
OIDC_ISSUER_URI=https://idp.example.com/realms/user-kit
OIDC_AUDIENCES=user-kit-api
OIDC_ROLES_CLAIM=roles
DEV_AUTH_ENABLED=false

OIDC_CLIENT_ENABLED=true
OIDC_CLIENT_ID=user-kit-bff
OIDC_CLIENT_SECRET=the-secret-of-that-client
OIDC_CLIENT_REDIRECT_URI=https://user-kit.local/api/v1/auth/callback
OIDC_CLIENT_POST_LOGOUT_REDIRECT_URI=https://user-kit.local/
OIDC_CLIENT_SCOPES=openid profile email
OIDC_COOKIE_SECURE=true
```

Redirect URIs must match exactly. The client secret lives only in the backend environment, so a
user of the frontend bundle cannot impersonate the client.

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
`OIDC_ISSUER_URI=https://<host><prefix>/realms/user-kit` plus the matching
`OIDC_CLIENT_POST_LOGOUT_REDIRECT_URI` and the registered redirect URIs of `user-kit-bff`.

`keycloak/realm/user-kit-realm.json` registers several post logout URIs at once. Keycloak stores
that client attribute as a single string and splits it on `##`, so a comma separated value is read
as one unusable URI and the provider answers the logout with `Invalid redirect uri` instead of
redirecting.

### Split issuer for the backend

`OIDC_JWK_SET_URI` and `OIDC_CLIENT_ISSUER_URI` are optional and only needed when the public URL is
not reachable from the backend. Docker compose uses both, because the public URL is
`https://user-kit.local/...` with a self signed certificate while the container reaches Keycloak over
plain HTTP:

```bash
OIDC_ISSUER_URI=https://user-kit.local/auth/realms/user-kit
OIDC_JWK_SET_URI=http://keycloak:8080/auth/realms/user-kit/protocol/openid-connect/certs
OIDC_CLIENT_ISSUER_URI=http://keycloak:8080/auth/realms/user-kit
```

`iss` is still validated against `OIDC_ISSUER_URI` and discovery happens against
`OIDC_CLIENT_ISSUER_URI`, so the tokens of the browser keep the public issuer while the backend does
not have to trust its own certificate.

## Local development issuer

The local Keycloak of docker compose is the default. For a quick look without a login dialog the
backend can additionally publish a second, local issuer (`user-kit-dev`, HS256) with
`DEV_AUTH_ENABLED=true`:

```bash
curl -sk "https://user-kit.local/api/v1/dev/token?role=admin"
curl -sk "https://user-kit.local/api/v1/dev/token?role=user&subject=jane@example.com"
```

The browser uses `POST /api/v1/auth/dev-login` instead: the response body carries the profile but no
token, the token goes into `UK_DEV_TOKEN`. The endpoint exists only when `DEV_AUTH_ENABLED=true` and
needs the CSRF token like every other unsafe method. Because the dev cookie is a bearer token, the
requests that carry it are exempt from CSRF afterwards; the local login is a convenience, the identity
provider flow of a deployed environment is the one that relies on the CSRF token.

Details:

- Tokens carry `sub`, `preferred_username`, `email`, `name` and `roles`, and live 12 hours.
- `subject` is optional. Without it a random subject is generated, which creates a new account on
  the first call, so the account list grows while experimenting.
- The dev issuer is only registered when the `dev` profile is active. In any other profile the
  endpoints do not exist and `StartupValidator` logs a warning if the secret is still the default.
- `DEV_AUTH_SECRET` must be at least 32 characters; change it for every shared environment.
- `GET /api/v1/dev/token` stays available for scripts; the frontend never calls it.

Never enable the dev issuer in a production deployment: `docker-compose.yml` sets
`SPRING_PROFILES_ACTIVE=dev` for convenience, so override it and set `DEV_AUTH_ENABLED=false`
before exposing the stack. While both issuers are active the resource server accepts a token as soon
as one of them validates it, see `JwtDecoderConfiguration`.

## Demo documents

`DemoDataSeeder` belongs to the same `dev` profile: on an empty store it creates the local account
`demo` (subject `local-demo-owner`) and uploads eight sample documents through `FileService`, so the
seeder reuses the validation, checksum and storage key rules of a real upload. As soon as one document
exists the seeder does nothing, which makes restarts idempotent, and `DEMO_DATA_ENABLED=false`
switches it off. The documents are plain PDF, CSV, Markdown and text files that `SimplePdf` generates
without a PDF library; a second demo user would therefore never need binary resources in the
repository.

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

- `frontend/src/features/auth/cookie/cookieAuthProvider.ts` is the only provider: it reads
  `/api/v1/auth/config`, navigates to `/api/v1/auth/login` and calls `/api/v1/auth/dev-login` when the
  backend offers the local login.
- `frontend/src/shared/api/http.ts` sends every request with `credentials: 'include'` and adds
  `X-XSRF-TOKEN` for unsafe methods. It never attaches an `Authorization` header.
- `frontend/src/entities/user/model/roles.ts` maps claims to the two roles, mirroring the backend, so both sides
  agree on what `admin` means.
- There is no silent renew in the frontend: the backend refreshes before the token expires. A rejected
  refresh makes `/api/v1/me` answer `401`, which brings the login screen back.
- No token, not even an access token, is written to `localStorage`, `sessionStorage` or the DOM.

## Hardening checklist

- [ ] `SPRING_PROFILES_ACTIVE` is not `dev` in production.
- [ ] `DEV_AUTH_ENABLED=false` and `DEV_AUTH_SECRET` is not the default value.
- [ ] `OIDC_CLIENT_SECRET` is the production secret of the confidential client, not the value of the
      shipped realm.
- [ ] `OIDC_COOKIE_SECURE=true` whenever the application is served over HTTPS.
- [ ] `OIDC_SESSION_TTL` is short enough that a stolen cookie expires on its own.
- [ ] `OIDC_ISSUER_URI` uses `https://` and matches the token issuer exactly.
- [ ] `OIDC_AUDIENCES` contains the client id of the backend, so tokens minted for other clients of
      the same realm are rejected.
- [ ] `KC_HOSTNAME` of Keycloak matches the URL the browser uses, prefix included.
- [ ] Keycloak runs on its own database instead of `dev-file`, and the realm import directory is
      not mounted in production.
- [ ] Direct access grants of `user-kit-web` and `user-kit-bff` are disabled.
- [ ] The redirect URIs of `user-kit-bff` list only hosts the application really runs on.
- [ ] `CORS_ALLOWED_ORIGINS` lists exactly the origins that need browser access, or stays empty for
      a same origin deployment.
- [ ] `/v3/api-docs` and `/swagger-ui` are restricted at the edge if the contract must stay private.
- [ ] A real TLS certificate is used, see [`deployment.md`](deployment.md).
