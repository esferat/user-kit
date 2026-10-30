# Frontend

This document covers `frontend-main/`, the main frontend of the monorepo: a Next.js 16 application
(React 19, pnpm 12, Ant Design 6) served by the edge on both application domains. The browser games
that used to live here were extracted into the standalone `games/` project on
`user-kit.games.local`; only the stubs `/games/chess` and `/games/checkers` remain in this app.

## Stack

| Package                                            | Version | Purpose                                          |
| -------------------------------------------------- | ------- | ------------------------------------------------ |
| `next`                                             | 16.4    | app router, server components, standalone output |
| `react`, `react-dom`                               | 19.x    | UI runtime                                       |
| `typescript`                                       | 5.9     | strict type checking                             |
| `antd`, `@ant-design/icons`                        | 6.x     | component library, theme, icons                  |
| `eslint`, `eslint-config-next`                     | 9.x     | linting, Next.js rules                           |

| | |
| --- | --- |
| UI library | `antd` 6, `@ant-design/icons` 6 |
| Domains | `user-kit.local` (canonical, hosts `/auth`) and `user-kit.next.local` |
| Dev server | `http://localhost:3000` |
| Theme storage key | `user-kit:theme` |
| Locale storage key | `user-kit:locale` |

The interface is bilingual, Russian (`ru`) and English (`en`), see [Localization](#localization). The
code, comments, API and documentation are English; the source comments of the application are
Russian.

## Feature Sliced Design

The application follows [Feature Sliced Design](https://feature-sliced.design): layers may only
import from the layers below them, and every cross slice import goes through the public API of the
target slice (`@/shared/api`, never `@/shared/api/http`). The ESLint of the project does not check
these boundaries, so they are kept by hand.

```
frontend-main/src/
├── app/                       routes (composition root)
│   ├── layout.tsx             root layout: Ant Design registry and providers
│   ├── page.tsx               public landing page
│   ├── providers.tsx          client providers
│   ├── login/                 login screen
│   └── (protected)/           session required: admin/, profile/, profile/edit/, games/ (stubs)
├── widgets/                   large blocks
│   └── app-shell/             header, profile menu, role-filtered navigation in a left sider
├── features/                  user facing capability
│   ├── auth/                  CookieAuthProvider, SessionStore, useAuth, LoginScreen, ProfileMenu
│   └── profile-edit/          createProfileApi (PATCH /api/v1/me, avatar POST/DELETE), form
├── entities/                  business data and the operations on it
│   └── user/                  profile type, roles.ts (claims → admin/user), ui/
└── shared/                    infrastructure reused by everything above
    ├── api/                   http.ts: credentials, CSRF, ApiError, PageResponse
    ├── config/                NEXT_PUBLIC_API_BASE_URL parsing
    └── lib/                   format, message, router, hooks
```

Consequences worth keeping in mind:

- `app` is the only layer that knows every other layer; a widget must not import a page.
- `shared` must not import from `entities`, `features`, `widgets` or `pages`.
- Route files stay thin: navigation, session and HTTP logic live in the lower slices.

## API client

The transport is one shared file, `src/shared/api/http.ts`. Every entity builds its own typed client
on top of it, so the FSD layers stay clean.

`http.ts` exports:

| Export                             | Purpose                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `request` / `requestJson<T>`       | `fetch` with the cookie/CSRF rules below, JSON parsing, `204` handling  |
| `joinUrl(baseUrl, path)`           | concatenation without doubled slashes                                   |
| `ApiError`                         | `status`, `code`, `body`, `isUnauthorized`; thrown on a non `ok` answer |
| `PageResponse<T>`                  | `{ items, total, page, size }`, the envelope of every list endpoint     |
| `readCookie`, `csrfHeaders`        | read `XSRF-TOKEN`, emit `X-XSRF-TOKEN` on unsafe methods                |

Rules applied by `request`:

- `credentials: 'include'` — the browser sends the httpOnly session cookie; nothing attaches a token.
- On `POST`, `PATCH` and `DELETE` the value of the `XSRF-TOKEN` cookie is echoed in `X-XSRF-TOKEN`.
- `Accept: application/json`; `Content-Type: application/json` for a JSON body, omitted for a
  `FormData` upload (the browser sets the multipart boundary).
- A non `ok` response is mapped to `ApiError` using the JSON error document of the backend.
- A `signal` aborts the request.

### Query interface

`GET /api/v1/files` and `GET /api/v1/users` share the list query `search`, `sort`, `page`, `size`;
the clients build the URL with `URLSearchParams` from a typed query object, no raw filter string is
ever concatenated. Updates send `If-Match` with the `etag` the row was rendered with, so an edit
based on stale data is rejected by the backend with `412`.

## Routing

Next.js app router with a route group for the protected area. `src/proxy.ts` performs an optimistic
check: the landing page `/` and `/login` are public, while any other request without
`UK_SESSION`/`UK_DEV_TOKEN` is redirected to `/login`. The real authorization stays on the backend
(`GET /api/v1/me` and the REST API).

| Route                        | Page                                | Access          |
| ---------------------------- | ----------------------------------- | --------------- |
| `/`, `/login`                | landing, login                      | public          |
| `/profile`, `/profile/edit`  | profile, avatar and data edit       | `user`, `admin` |
| `/admin`                     | account administration, roles       | `admin`         |
| `/games/{chess,checkers}`    | game stubs, "not implemented yet"  | `user`, `admin` |

The `Игры` menu group keeps two more entries — «Три в ряд» and «Цветные линии» — as absolute links
to the standalone games project (`appConfig.gamesBaseUrl`, `NEXT_PUBLIC_GAMES_BASE_URL`, default
`https://user-kit.games.local`); `AppShell` opens such keys with `window.location.assign`. The
navigation entries of `widgets/app-shell` are filtered by role, so a crafted URL never leads to
a menu entry the user is not entitled to; the backend rejects the data requests anyway.

## Localization

The application ships a small translator instead of a full i18n framework: two dictionaries of flat
dotted keys, `{placeholder}` interpolation and CLDR plural forms, read through React:

- The choice of the user is stored in `localStorage` under `user-kit:locale`.
- Every lookup sets `document.documentElement.lang`, so the component library formats dates and
  numbers in the same language.
- A missing key falls back to `ru` and finally to the key itself, so an incomplete translation shows
  the key instead of an empty screen.

## Authentication

There is exactly one provider, `CookieAuthProvider` (`src/features/auth/`). The backend is the OAuth
client, so the frontend never sees a client secret, an access token or a refresh token:

| Backend `GET /api/v1/auth/config` | Behaviour of the login screen                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `oidc`                            | Button navigates to `/api/v1/auth/login`, the provider shows its form, the callback sets the cookies |
| `dev`                             | Button calls `POST /api/v1/auth/dev-login`, the token goes into a cookie                             |
| `none`                            | The screen shows a configuration error instead of a login button                                     |

The provider restores the session once, follows every later change (that is how the logout of the
profile menu brings the login screen back) and exposes `user`, `status` (`restoring`, `anonymous`,
`authenticated`) and the reason of a failed restore. Silent renew is not a frontend concern: the
backend refreshes before the access token expires, so a rejected refresh only shows up as a `401`
on `/api/v1/me`.

`src/entities/user/model/roles.ts` maps provider claims to `admin`/`user` in the same order as the
backend, so the navigation and the API agree on the role of the session.

## Theme

The theme is a light/dark switch in the shell bar, applied through `ConfigProvider` with
`theme.defaultAlgorithm` / `theme.darkAlgorithm` and the matching `antd` locale. The choice is
persisted in `localStorage` and `document.documentElement.dataset.theme` is set, so the plain CSS of
the shell follows too.

Ant Design creates its css-in-js cache with `Math.random()`, a value `cacheComponents` forbids
during prerender. The client tree therefore streams behind the `<Suspense>` in the root layout.

## Module Federation host

The profile area lives in the separate microfrontend `user-profile/` (own domain, own BFF) and is
loaded into the host through Module Federation. Three exposes are used, each loaded by
`src/shared/lib/remote.ts` and rendered by its own slot:

| Expose | Where in the host | Props |
| ------ | ----------------- | ----- |
| `user_profile/ProfilePage` | `/profile` — the personal cabinet page | `onEdit` (host router pushes `/profile/edit`) |
| `user_profile/ProfileEdit` | `/profile/edit` — the edit form | `onSaved` (optional) |
| `user_profile/ProfileAvatar` | the avatar in the header menu | `name` — placeholder while the remote reads the profile |

The host keeps a local fallback for the menu avatar (an antd `Avatar` with the initials and the
thumbnail of the restored session): if the remote chunk is still loading or the microfrontend is
down, the header still shows who is signed in. The page slots degrade to a skeleton / an `Alert`
the same way.

Saving a new avatar updates the header automatically. Inside one tab this is plain TanStack Query:
`AppProviders` gives every expose the same browser-singleton `QueryClient`, so the
`invalidateQueries` after a successful save reaches the menu avatar and the profile card. Across
tabs the remote talks over a `BroadcastChannel` (`entities/user/model/profileSync.ts`): the edit
form publishes, `useProfileQuery` subscribes and refetches. The backend versiones avatar URLs
(`?v=<avatarUpdatedAt>`), so the refetched data carries a new image URL and the browser cache is
not in the way.

- `src/shared/lib/remote.ts` calls `init()` from `@module-federation/runtime` with the remote
  `user_profile` (`${NEXT_PUBLIC_PROFILE_BASE_URL}/static/mf-manifest.json`) and registers `react`,
  `react-dom` and `react-dom/client` as singletons taken from the host. The shared entries carry
  `lib`, which marks them loaded: the host stays the owner of the framework instance and the remote
  cannot put its own copy into the same slot. Two React instances would crash the remote component
  with an invalid hook call.
- `react-dom/client` needs its own key: an exact share key `react-dom` does not match the sub-path,
  so the remote would otherwise bundle its own client renderer. App Router always renders through
  the React copy compiled into Next (`next/dist/compiled/react`, a canary), while the remote builds
  against npm React — and `react-dom/client` verifies `react.version` against its own build, which
  threw `Incompatible React versions` (module-federation/core#4727). Sharing the sub-path makes the
  remote consume the host pair, canary and canary. The host entries are imported lazily, so the
  server bundle never touches `react-dom/client`.
- Sharing runs with `shareStrategy: 'loaded-first'`: an already loaded instance wins over a higher
  version, so the host pair (React from the copy compiled into Next) is always the one in use.
- The page loads the expose in an effect and renders it only on the client: the manifest and the
  chunks come from another origin, the server never sees them. A failed load shows an `Alert` with
  the reason instead of an empty page.
- `antd` is deliberately not shared: the remote bundles its own copy together with its `rc-*`
  internals, and sharing would tie the host to the version pinned in the other project.

The browser fetches `mf-manifest.json` cross origin, so the profile virtual host sends CORS headers
(the chunks are plain script tags and need none). `/profile-api/` is proxied on the canonical domain
too, so the component keeps its BFF calls same origin, where the host-only session cookie lives.

## Build time configuration

Next.js inlines every `NEXT_PUBLIC_*` variable into the bundle at build time, so the configuration
is fixed when the image is built. `docker-compose.yml` passes `VITE_API_BASE_URL` to the build as
`NEXT_PUBLIC_API_BASE_URL` and derives `NEXT_PUBLIC_PROFILE_BASE_URL` from `SERVER_NAME_PROFILE`
(`frontend-main/Dockerfile`, `ARG`):

```yaml
frontend-main:
  build:
    context: ./frontend-main
    args:
      NEXT_PUBLIC_API_BASE_URL: ${VITE_API_BASE_URL:-}
      NEXT_PUBLIC_PROFILE_BASE_URL: https://${SERVER_NAME_PROFILE:-user-kit.profile.local}
```

Consequences worth keeping in mind:

- A change to any `NEXT_PUBLIC_*` variable requires `docker compose up -d --build frontend-main`;
  a plain restart keeps the old bundle. The same applies to a moved `user-profile` origin.
- Identity provider settings are **not** build arguments, so a provider change only needs a backend
  restart. `scripts/smoke.ps1` verifies that the deployed bundle contains neither the realm issuer
  nor an OIDC client library.
- An empty `NEXT_PUBLIC_API_BASE_URL` means same origin: the API is reached through the edge.

## Build and container

`pnpm build` runs `tsc` and writes `.next/`; `next.config.ts` enables `cacheComponents`,
`partialPrefetching`, `reactCompiler` and `output: "standalone"`, so the Docker image can run the
minimal server:

- `Dockerfile`: `node:22-alpine` base, `deps` runs `pnpm install --frozen-lockfile`, `builder`
  receives `NEXT_PUBLIC_API_BASE_URL` and runs `pnpm run build`, `runner` copies
  `.next/standalone` and `.next/static` and starts `node server.js` as the `nextjs` user on port
  3000.
- The edge proxies `/` to `frontend-main:3000` on both domains and routes `/api/`, `/auth/` and the
  documentation paths exactly like the canonical domain.

Because this Next.js build differs from a stock release, `frontend-main/AGENTS.md` warns to read
the bundled docs under `node_modules/next/dist/docs/` before changing application code.

## Code quality

```bash
pnpm lint    # eslint .
pnpm build   # tsc + production build
```

## Tests

The games moved to the standalone `games/` project and have no tests in the repository; they are
checked with temporary harnesses on esbuild + puppeteer (the engine logic lives in pure modules
`game/engine.ts` and `game/*Storage.ts`, which are tested without a browser).
