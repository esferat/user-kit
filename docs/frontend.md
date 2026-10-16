# Frontend

This document covers the two Vite applications, `frontend-antd/` and `frontend-mui/`, and the
`fullstack-next/` Next.js application. The two Vite applications render the same screens against the
same REST API; the deliberate difference is the component library and the state library.

## Stack

| Package                                                                                                                              | Version                            | Purpose                                          |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------ |
| `vite`, `@vitejs/plugin-react`                                                                                                       | 8.x / 6.x                          | build, dev server, JSX transform                 |
| `react`, `react-dom`                                                                                                                 | 19.x                               | UI runtime, `createRoot`, `StrictMode`           |
| `typescript`                                                                                                                         | 5.9                                | strict type checking, no emit                    |
| `vitest`, `happy-dom`                                                                                                                | 5.x / 20.x                         | unit tests with a DOM                            |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom`                                                      | 16.x / 14.x / 10.x                 | rendering and interaction of components          |
| `eslint`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import-x`, `eslint-plugin-sonarjs` | 9.x / 8.x / 7.x / 7.x / 4.x / 3.x | linting, hooks rules, import rules, SonarJS rules |
| `prettier`, `eslint-plugin-prettier`                                                                                                 | 3.x / 5.x                          | formatting, enforced through ESLint              |

| | `frontend-antd/` | `frontend-mui/` |
| --- | --- | --- |
| UI library | `antd` 6, `@ant-design/icons` 6 | `@mui/material` 7, `@mui/icons-material` 7, `@emotion/*` 11 |
| State | `mobx` 6, `mobx-react-lite` 4 | `@reduxjs/toolkit` 2, `react-redux` 9 |
| Domain | `user-kit.local` (canonical) | `user-kit.mui.local` |
| Dev server | `http://localhost:5174` | `http://localhost:5175` |
| Theme variable | `VITE_ANTD_THEME` | `VITE_MUI_THEME` |
| Theme storage key | `user-kit-antd:theme` | `user-kit-mui:theme` |

Both share the locale storage key `user-kit:locale`. The interface is bilingual, Russian (`ru`) and
English (`en`), see [Localization](#localization). The code, comments, API and documentation are
English; the source comments of the applications are Russian.

## Feature Sliced Design

Both applications follow [Feature Sliced Design](https://feature-sliced.design): layers may only
import from the layers below them, and every cross slice import goes through the public API of the
target slice (`@/shared/api`, never `@/shared/api/http`). ESLint enforces both rules, see
[Code quality](#code-quality).

```
frontend-antd/src/
├── main.tsx                   createRoot, StrictMode, error boundary
├── app/                       composition root: services, shell, startup error
│   ├── App.tsx                reads the session and renders login or shell
│   ├── model/useAppServices   API clients, router and stores of the run
│   └── ui/                    ErrorBoundary, StartupError, ThemeBootstrap, AppThemeProvider
├── pages/                     documents, login, users — one slice per route
│   ├── documents/             DocumentsPage, filesStore (antd) / documentsSlice (mui)
│   ├── login/
│   └── users/                 UsersPage, usersStore (antd) / usersSlice (mui)
├── widgets/                   large blocks: app shell, tables
│   ├── app-shell/             navigation layout, side navigation, profile menu
│   ├── documents-table/
│   └── users-table/
├── features/                  user facing capability, can be switched on and off
│   ├── auth/                  cookie provider, session store
│   ├── file-download/
│   ├── file-upload/
│   ├── locale-switch/
│   ├── theme-switch/          theme store/slice and the shell bar item
│   └── user-role/
├── entities/                  business data and the operations on it
│   ├── file/                  types and createFileApi()
│   └── user/                  types, role model and createUserApi()
└── shared/                    infrastructure reused by everything above
    ├── api/                   http wrapper, joinUrl, PageResponse, ApiError
    ├── config/                environment parsing
    ├── i18n/                  translator, dictionaries, React bindings
    ├── lib/                   format, message, router, async store helpers
    └── ui/                    small presentational helpers
```

`frontend-mui/src` mirrors this tree; the only structural difference is that feature and page models
are Redux slices instead of MobX stores.

Consequences worth keeping in mind:

- `app` is the only layer that knows every other layer; a widget must not import a page.
- `shared` must not import from `entities`, `features`, `widgets` or `pages`.
- A page may be reused by another page only through its public API.
- A component is a `.tsx` file in PascalCase under `ui/`; everything that is not a component stays a
  plain `.ts` file, including the models and the API clients.

## Rendering model

`main.tsx` mounts the application once and wraps it in the two things that have to survive a broken
build or a broken configuration:

```tsx
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
```

`App` reads the session and renders either the login screen or the shell; the shell owns the router
and renders the page of the current route.

### State: MobX in `frontend-antd`, Redux in `frontend-mui`

`frontend-antd` keeps the state in MobX stores, created once per run in `useAppServices`. A component
reads what it renders and is wrapped in `observer`, so a change of a store repaints exactly the
components that read it:

```tsx
export const DocumentsPage = observer(function DocumentsPage() {
  const store = useFilesStore();
  return <DocumentsTable files={store.files} loading={store.loading} />;
});
```

`frontend-mui` uses Redux Toolkit. `store.ts` calls `configureStore` with the reducers `session`,
`documents`, `users` and `theme`, and injects the API services as the thunk `extraArgument`. Typed
`useAppDispatch` / `useAppSelector` hooks live in `app/model/hooks.ts`, and `shared/lib/redux.ts`
holds the cross layer `AppDispatch` type.

| Concern            | `frontend-antd`                                              | `frontend-mui`                                  |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| session            | `SessionStore` of `features/auth`                           | `sessionSlice`                                  |
| page data          | `FilesStore` / `UsersStore`                                 | `documentsSlice` / `usersSlice`                 |
| theme              | `ThemeStore` of `features/theme-switch`                     | `themeSlice`                                    |
| route              | `useRoute(router)` through `useSyncExternalStore`           | same                                             |
| language           | `useTranslate()` / `useLocale()`                            | same                                             |

Both keep the i18n store and the hash router outside of their state library on purpose: they are read
with `useSyncExternalStore`, so they need no lifecycle of their own and stay testable without React.

### Asynchronous work

In `frontend-antd` a store wraps the request in an observable `AsyncResource` that keeps the result of
the most recent run only, so a slow reload can never overwrite a newer one and a failure keeps the data
already on screen. `start()` is idempotent, so `StrictMode` mounting the tree twice does not send the
request twice.

```ts
class FilesStore {
  files: FileObjectDto[] = [];
  query: FileListQuery = NEWEST_FIRST;

  private readonly list = new AsyncResource(() => this.fileApi.list(this.query));

  start(): () => void {
    return reaction(
      () => this.query,
      () => void this.list.fetch(),
    );
  }

  async refresh(): Promise<void> {
    this.message = undefined;
    await this.list.fetch();
  }
}
```

In `frontend-mui` the same lifecycle is a thunk per slice (`createAsyncThunk`), with `pending`,
`fulfilled` and `rejected` reducers updating the slice state.

## API client

The transport is one shared file, `src/shared/api/http.ts`, identical in both applications. Every
entity builds its own typed client on top of it, so the FSD layers stay clean: `entities/file` exports
`createFileApi()` and `entities/user` exports `createUserApi()`, both taking `{ baseUrl }`.

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

`GET /api/v1/files` and `GET /api/v1/users` share the same list query. Each client builds the URL with
`URLSearchParams` from a typed query object (`FileListQuery` / `UserListQuery`: `search`, `sort`,
`page`, `size`); no raw filter string is ever concatenated.

| Client | Methods |
| --- | --- |
| `createFileApi` | `list(query)`, `upload(file, description)`, `downloadContent(id)`, `remove(id, etag?)` |
| `createUserApi` | `me()`, `list(query)`, `updateRoles(id, roles, etag?)` |

`updateRoles` and `remove` send `If-Match` with the `etag` the row was rendered with, so an edit based
on stale data is rejected by the backend with `412`.

The clients are created once per run in `useAppServices(config)` and reach the application through the
services object / Redux extra argument, so no module holds a client.

## Routing

The router is hash based and dependency free (`src/shared/lib/router/hashRouter.ts`).

| Route           | Page                                | Access          |
| --------------- | ----------------------------------- | --------------- |
| `#/documents`   | file list, upload, download, delete | `user`, `admin` |
| `#/admin-users` | account administration, roles       | `admin`         |

The navigation entries are filtered by role, and the shell resolves every hash against the routes the
current user may open. An unknown or forbidden hash falls back to the first allowed route, so a
crafted URL never renders content the user is not entitled to. `navigate()` suppresses the duplicate
`hashchange` event, so a route is rendered exactly once.

## Localization

`src/shared/i18n` holds a small translator instead of a full i18n framework: two dictionaries of flat
dotted keys, `{placeholder}` interpolation and CLDR plural forms. Components read it through React:

```tsx
const t = useTranslate();
return <Title>{t("documents.title")}</Title>;
```

| Part                             | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `locales/ru.ts`, `locales/en.ts` | the dictionaries, one flat object per language                     |
| `i18n.ts`                        | `createI18n()` with `t`, `locale`, `availableLocales`, `setLocale` |
| `store.ts`                       | the singleton, the stored choice of the user                       |
| `react.tsx`                      | `useLocale()` and `useTranslate()`                                 |

- The initial locale comes from `VITE_DEFAULT_LOCALE`, the choice of the user is stored in
  `localStorage` under `user-kit:locale` and wins over it.
- Every lookup sets `document.documentElement.lang`, so the component library formats dates and
  numbers in the same language.
- A missing key falls back to `ru` and finally to the key itself, so an incomplete translation shows
  the key instead of an empty screen. A test enforces key parity between the dictionaries.

## Authentication

There is exactly one provider, `CookieAuthProvider`. The backend is the OAuth client, so the frontend
never sees a client secret, an access token or a refresh token:

| Backend `GET /api/v1/auth/config` | Behaviour of the login screen                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `oidc`                            | Button navigates to `/api/v1/auth/login`, the provider shows its form, the callback sets the cookies |

In `oidc` mode the screen also offers a registration link when `registrationEnabled` is set:
`AuthProvider.register()` navigates to `/api/v1/auth/register`, which sends the browser to the
registration page of the provider. Both frontends reach it through the shared `login.register` label.
| `dev`                             | Button calls `POST /api/v1/auth/dev-login` with `VITE_DEV_ROLE`, the token goes into a cookie        |
| `none`                            | The screen shows a configuration error instead of a login button                                     |

There is no build time mode, so a bundle cannot get out of sync with the provider configuration. The
first call of the login screen already tells which button to show, and the answer is cached for the
session. No request ever sets an `Authorization` header and no token is written to `localStorage`,
`sessionStorage` or the DOM. Silent renew is not a frontend concern: the backend refreshes before the
access token expires, so a rejected refresh only shows up as a `401` on `/api/v1/me`.

`AuthSessionProvider` turns the provider into React state: it restores the session once, follows every
later change the provider reports — that is how the logout of the profile menu brings the login screen
back — and exposes `user`, `status` (`restoring`, `anonymous`, `authenticated`) and the reason of a
failed restore.

## Theme

The theme is a light/dark switch in the shell bar. `frontend-antd` applies it through
`ConfigProvider` with `theme.defaultAlgorithm` / `theme.darkAlgorithm` and the matching `antd` locale;
`frontend-mui` uses `createTheme({ palette: { mode } })` with `ThemeProvider` and `CssBaseline`. Both
persist the choice in their own `localStorage` key and set `document.documentElement.dataset.theme`, so
the plain CSS of the shell follows too.

## Build time configuration

Vite inlines every `VITE_*` variable into the bundle, so the configuration is fixed when the image is
built. Each `Dockerfile` declares the variables of its application as `ARG`s and `docker-compose.yml`
forwards them from the root `.env`:

```yaml
frontend-antd:
  build:
    context: ./frontend-antd
    args:
      VITE_API_BASE_URL: ${VITE_API_BASE_URL:-}
      VITE_ANTD_THEME: ${VITE_ANTD_THEME:-light}
      VITE_DEFAULT_LOCALE: ${VITE_DEFAULT_LOCALE:-ru}
      VITE_DEV_ROLE: ${VITE_DEV_ROLE:-admin}
```

Consequences worth keeping in mind:

- A change to any `VITE_*` variable requires `docker compose up -d --build frontend-antd frontend-mui`;
  a plain restart keeps the old bundles.
- Identity provider settings are **not** build arguments, so a provider change only needs a backend
  restart. `scripts/smoke.ps1` verifies that the deployed bundle contains neither the realm issuer nor
  an OIDC client library.
- If the application cannot even render, `ErrorBoundary` catches the failure of the first render and
  `StartupError` explains it instead of leaving an empty page; the same reason is still logged to the
  console.

## Build and container

`npm run build` type checks and writes `dist/`. Each Docker image builds with `node:22-alpine` and
serves the result with `nginx:1.27-alpine`:

- `index.html` is sent with `Cache-Control: no-store`,
- `/assets/` is cached for one year with `immutable`,
- unknown paths fall back to `index.html` for client side routing,
- a `HEALTHCHECK` verifies that the server answers.

Vite splits the vendor code into a chunk per library (`manualChunks`: `antd` in one application,
`mui` and `redux` in the other) and prints a warning because the entry chunk exceeds the default
500 kB limit. Raise `build.chunkSizeWarningLimit` in `vite.config.ts` if the warning is noise for your
pipeline.

## Code quality

```bash
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run check        # format:check + lint + typecheck + test
```

`npm run check` is the gate for a commit. `eslint.config.mjs` is a flat config built on
`js.configs.recommended`, `typescript-eslint`, `sonarjs/recommended` and
`eslint-plugin-prettier/recommended`, plus:

| Rule group                              | What it protects                                                          |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `no-restricted-imports` per FSD layer   | no import into a higher or equal layer, no deep import into a slice       |
| `no-restricted-imports` with `../../*`  | a slice stays self contained, relative imports reach one level up at most |
| `import-x/order`, `import-x/no-cycle`   | stable import order, no cycles between slices                             |
| `react-hooks`                           | hook dependencies and the rules of the compiler                           |
| `sonarjs/recommended`                   | duplication, complexity, common bug patterns                              |

## Tests

```bash
npm test              # vitest run
npm run test:coverage # V8 coverage, writes text, html and lcov reports
```

Components are tested with Testing Library: render the component, query by role or by test id, and
fire the events the component library emits. Nothing reaches into a component `ref`, and no test
asserts on internal state beyond the properties the application sets. `src/shared/api/http.test.ts`
covers the headers, the error mapping and the abort handling; each entity API has a test for the built
URLs, and each page model a test for its query, upload, download, delete and failure paths.

`vitest.setup.ts` calls `cleanup()` after every test, because Testing Library only does that
automatically when it finds a global `afterEach` and this project imports the hooks from `vitest`
explicitly.

## Next.js application

`fullstack-next/` is a Next.js 16 application (React 19, pnpm 12, Ant Design 6) served by the edge on
`user-kit.next.local`. It implements the cookie-based BFF authorization of the monorepo: the browser
never sees a token, it only holds the `HttpOnly` cookies the backend sets.

The code follows Feature-Sliced Design:

- `src/shared/` — `api/http.ts` (`credentials: 'include'`, the `XSRF-TOKEN` → `X-XSRF-TOKEN` header on
  unsafe methods, `ApiError`), `config/` (`NEXT_PUBLIC_API_BASE_URL`, empty means same origin) and small
  helpers.
- `src/entities/user/` — the profile type and `roles.ts`, which maps provider claims to `admin`/`user`
  in the same order as the backend.
- `src/features/auth/` — the `CookieAuthProvider` (`config` → `login` by navigation, `dev-login`,
  `restore`, `logout`), the `SessionStore` behind `useSyncExternalStore` and `useAuth`, and the
  `LoginScreen`/`ProfileMenu` components.
- `src/widgets/app-shell/` — the header, profile menu and role-filtered navigation.
- `src/app/` — the root layout (Ant Design registry and providers), `login/`, the `(protected)` route
  group and `providers.tsx`.

`src/proxy.ts` performs an optimistic check: a request without `UK_SESSION`/`UK_DEV_TOKEN` is redirected
to `/login`, while the real authorization stays on the backend (`GET /api/v1/me` and the REST API). The
route files stay thin; navigation, session and HTTP logic live in the lower slices.

`next.config.ts` enables `cacheComponents`, `partialPrefetching`, `reactCompiler` and
`output: "standalone"`, so the Docker image can run the minimal server:

- `Dockerfile`: `node:22-alpine` base, `deps` runs `pnpm install --frozen-lockfile`, `builder` receives
  `NEXT_PUBLIC_API_BASE_URL` and runs `pnpm run build`, `runner` copies `.next/standalone` and
  `.next/static` and starts `node server.js` as the `nextjs` user on port 3000.
- The edge proxies `/` to `fullstack-next:3000` and routes `/api/`, `/auth/` and the documentation paths
  exactly like the canonical domain.

Ant Design creates its css-in-js cache with `Math.random()`, a value `cacheComponents` forbids during
prerender. The client tree therefore streams behind the `<Suspense>` in the root layout.

Because this Next.js build differs from a stock release, `fullstack-next/AGENTS.md` warns to read the
bundled docs under `node_modules/next/dist/docs/` before changing application code.
