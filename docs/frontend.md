# Frontend

## Stack

| Package | Version | Purpose |
| --- | --- | --- |
| `vite`, `@vitejs/plugin-react` | 8.x / 6.x | build, dev server, JSX transform |
| `react`, `react-dom` | 19.x | UI runtime, `createRoot`, `StrictMode` |
| `typescript` | 5.9 | strict type checking, no emit |
| `vitest`, `happy-dom` | 5.x / 20.x | unit tests with a DOM |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom` | 16.x / 14.x / 10.x | rendering and interaction of components |
| `@ui5/webcomponents`, `@ui5/webcomponents-fiori` | 2.27 | Fiori 3 web components |
| `@ui5/webcomponents-react` | 2.27 | React wrappers of those components |
| `@ui5/webcomponents-base`, `@ui5/webcomponents-icons` | 2.27 | `setTheme()`, icon collections |
| `oidc-client-ts` | 3.x | OIDC Authorization Code + PKCE |
| `eslint`, `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import-x`, `eslint-plugin-sonarjs` | 9.x / 8.x / 7.x / 7.x / 4.x / 3.x | linting, hooks rules, import rules, SonarJS rules |
| `prettier`, `eslint-plugin-prettier` | 3.x / 5.x | formatting, enforced through ESLint |

The interface is bilingual, Russian (`ru`) and English (`en`), see [Localization](#localization). The
code, comments, API and documentation are English.

## Why React on UI5 Web Components and not XML views

SAPUI5 applications are built with the [UI5 CLI](https://ui5.github.io/cli/v4), which compiles
`*.view.xml` into JavaScript and resolves views through a module loader at runtime. Reproducing that
pipeline inside a plain Vite build is not supported, and mixing both toolchains in one repository is
a known source of build issues.

The application therefore renders the same Fiori 3 components from `@ui5/webcomponents` — `ShellBar`,
`SideNavigation`, `Table`, `Dialog`, `FileUploader`, `MessageStrip`, `Toolbar`, `Input`, `Select` and
others — through the React wrappers of `@ui5/webcomponents-react`. React owns the state, the
composition and the lifecycle; the web components stay the rendering and the styling layer, which
keeps the visual result that SAPUI5 users expect while the project remains a standard Vite and
TypeScript application.

If a real SAPUI5 runtime is required, keep the backend as it is and replace the `frontend/` folder
with a UI5 CLI project that consumes the same OData and REST endpoints.

## Structure

The sources follow [Feature Sliced Design](https://feature-sliced.design): layers may only import
from the layers below them, and every cross slice import goes through the public API of the target
slice (`@/shared/api`, never `@/shared/api/http`). ESLint enforces both rules, see
[Code quality](#code-quality).

```
frontend/src/
├── main.tsx                   createRoot, StrictMode, icons, error boundary
├── app/                       composition root: services, shell, startup error
│   ├── App.tsx                reads the session and renders login or shell
│   ├── model/useAppServices   API clients, router and theme store of the run
│   └── ui/                    ErrorBoundary, StartupError, ThemeBootstrap
├── pages/                     documents, login, users — one slice per route
│   ├── documents/
│   ├── login/
│   └── users/
├── widgets/                   large blocks: app shell, tables
│   ├── app-shell/             navigation layout, side navigation, profile menu
│   ├── documents-table/
│   └── users-table/
├── features/                  user facing capability, can be switched on and off
│   ├── auth/                  OIDC and dev providers, session state
│   ├── file-download/
│   ├── file-upload/
│   ├── locale-switch/
│   ├── theme-switch/
│   └── user-role/
├── entities/                  business data and the operations on it
│   ├── file/
│   └── user/
└── shared/                    infrastructure reused by everything above
    ├── api/                   http wrapper, OData client and query builder
    ├── config/                typed access to VITE_* variables with validation
    ├── i18n/                  translator, dictionaries, React bindings
    ├── lib/                   async tasks, formatting, messages, hash router
    └── ui/                    icon names, message strip
```

A slice looks like this, every folder exports through `index.ts`:

```
src/widgets/app-shell/
├── index.ts                    the public API of the slice
├── model/navigation.ts         entries, role visibility, route resolution
└── ui/
    ├── AppShell.tsx            navigation layout, shell bar, side navigation
    └── ProfileMenu.tsx         user, logout
```

A slice exports named symbols, not `export *`, so the public API of a slice stays visible in one file:

```ts
export { DocumentsTable } from './ui/DocumentsTable';
export type { DocumentAction, DocumentsTableProps } from './ui/DocumentsTable';
```

Consequences worth keeping in mind:

- `app` is the only layer that knows every other layer; a widget must not import a page.
- `shared` must not import from `entities`, `features`, `widgets` or `pages`.
- A page may be reused by another page only through its public API.
- A component is a `.tsx` file in PascalCase under `ui/`; everything that is not a component stays
  a plain `.ts` file, including the models and the API clients.

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

There is no global store. State lives where it is used:

| Concern | Where |
| --- | --- |
| session | `useAuthSession()` from `features/auth`, fed by `AuthSessionProvider` |
| page data | `useAsyncTask()` per page, see [Asynchronous work](#asynchronous-work) |
| route | `useRouteId(router)` |
| interface language | `useTranslate()` / `useLocale()` |
| theme | `ThemeSwitchButton` reads `ThemeStore` through `useSyncExternalStore` |
| ephemeral dialog state | `useState` inside the component that owns the dialog |

Anything that already exists as an external store — the i18n store, the hash router, the theme
store — is read with `useSyncExternalStore`, so React stays consistent with it and the store keeps
its plain TypeScript API. That is what makes those three modules testable without React at all.

### Asynchronous work

`useAsyncTask` is the only place where a request becomes state:

```ts
const files = useAsyncTask(() => fileApi.list(query));

useEffect(() => {
  void files.run();
}, [files.run, query]);
```

It keeps the result of the most recent run only, so a slow reload can never overwrite a newer one,
and a failure keeps the data that is already on screen — which is what a list needs while it
refreshes. `run()` has a stable identity, so it is safe as an effect dependency, and results that
arrive after the unmount are dropped.

### UI5 components in React

`@ui5/webcomponents-react` renders the web components, and the web components keep their own API.
Four rules cover most of the surprises:

| Rule | Why |
| --- | --- |
| pass UI5 values as properties, not attributes | `Select`, `Table` and `MessageStrip` reflect booleans and enums onto properties (`value`, `loading`, `design`), a string attribute is ignored |
| wrap search fields in `ToolbarItem` | a `Button` or a `Select` inside a `ui5-toolbar` without its item wrapper logs a UI5 warning and is not slotted correctly |
| use `ToolbarSelect` and `ToolbarButton` for the actions of a toolbar | they carry the toolbar specific behaviour and styling |
| treat `ui5-file-uploader.files` as read only | the element owns the `FileList`; React must not write it, and tests shadow it with `Object.defineProperty` |

A component listens to the `change` event of UI5 through the wrapper:

```tsx
<Select
  value={role}
  onChange={(event) => {
    // UI5 also fires `change` when the value did not change.
    if (event.target.value !== role) {
      onChange(event.target.value as Role);
    }
  }}
>
```

## Routing

The router is hash based and dependency free (`src/shared/lib/router/hashRouter.ts`):

| Route | Page | Access |
| --- | --- | --- |
| `#/documents` | file list, upload, download, delete | `user`, `admin` |
| `#/admin-users` | account administration, roles | `admin` |

The navigation entries are filtered by role, and the shell resolves every hash against the routes the
current user may open. An unknown or forbidden hash falls back to the first allowed route, so a
crafted URL never renders content the user is not entitled to. `navigate()` suppresses the duplicate
`hashchange` event, so a route is rendered exactly once. The router itself also understands
parameters (`#/documents/42`), which the shell currently does not use: file details open inside the
documents page.

`useRouteId(router)` subscribes a component to the router with `useSyncExternalStore`. The snapshot is
the route id, a string, so React can compare it without re-rendering on every event.

## API client

The API is split per entity, which is what the FSD layers want: `entities/file` exports
`createFileApi()` and `entities/user` exports `createUserApi()`, and both take the shared
`ODataClient`.

| Factory | Operations |
| --- | --- |
| `createFileApi()` | `list(query)`, `upload(file, description)`, `downloadContent(id)`, `remove(id, etag?)` |
| `createUserApi()` | `me()`, `list(query)`, `updateRoles(id, roles, etag?)` |

`ODataClient` (`src/shared/api/odata/`) builds the URLs and maps the responses, and both clients add
what their endpoint needs on top: `multipart/form-data` for an upload, a blob for a download, an
`If-Match` header for a delete. Every call shares the fetch wrapper (`src/shared/api/http.ts`), which

- prefixes `baseUrl` (empty means same origin),
- adds `Authorization: Bearer …` when a token exists,
- sets `Accept: application/json` and `Content-Type` for bodies,
- maps error responses to `ApiError` with `status`, `code` and `message`,
- aborts after a configurable timeout.

`src/shared/api/odata/query.ts` never concatenates raw strings: property names are checked against an
allow list — `FILE_QUERYABLE_PROPERTIES` and `USER_QUERYABLE_PROPERTIES` — and literal values are
encoded, so a filter can only be built from known properties.

The clients are created once per run in `useAppServices(config)` and reach the running application
through the context-free props of the pages, so no module holds a client.

## Localization

`src/shared/i18n` holds a small translator instead of a full i18n framework: two dictionaries of flat
dotted keys, `{placeholder}` interpolation and CLDR plural forms. Components read it through React:

```tsx
const t = useTranslate();

return <Title>{t('documents.title')}</Title>;
```

| Part | Purpose |
| --- | --- |
| `locales/ru.ts`, `locales/en.ts` | the dictionaries, one flat object per language |
| `i18n.ts` | `createI18n()` with `t`, `locale`, `availableLocales`, `setLocale` |
| `store.ts` | the singleton, the stored choice of the user, `applyLanguage()` |
| `react.tsx` | `useLocale()` and `useTranslate()` |

- The initial locale comes from `VITE_DEFAULT_LOCALE`, the choice of the user is stored in
  `localStorage` under `user-kit:locale` and wins over it.
- Every lookup sets `document.documentElement.lang`, so the UI5 components format dates and numbers in
  the same language.
- Plural forms use the `one`, `few`, `many` and `other` categories of the language: Russian needs all
  four, English only `one` and `other`.
- A missing key falls back to `ru` and finally to the key itself, so an incomplete translation shows
  the key instead of an empty screen.
- `useTranslate()` subscribes to the locale, so switching the language in the shell bar re-renders
  every component that translated something — the route stays mounted and keeps its state.

## Authentication modes

| `VITE_AUTH_MODE` | Behaviour |
| --- | --- |
| `oidc` | Redirect to Keycloak, PKCE, session in `sessionStorage`, renew on expiry |
| `dev` | `GET /api/v1/dev/token?role=…` once at start, token in memory |

`assertConfigured()` fails fast with a readable message when `VITE_AUTH_MODE=oidc` is selected
without `VITE_OIDC_AUTHORITY` and `VITE_OIDC_REDIRECT_URI`, instead of failing later during login.
The failure then reaches `ErrorBoundary`, which renders `StartupError`.

`AuthSessionProvider` turns the provider into React state: it restores the session once, follows
every later change the provider reports — that is how the logout of the profile menu brings the login
screen back — and exposes `user`, `status` (`restoring`, `anonymous`, `authenticated`) and the reason
of a failed restore.

`StrictMode` runs every effect twice in development, and a second `restore()` of an OIDC redirect
callback would consume the same `code` and `state` twice. The restore therefore starts once per
provider instance, and its result is applied through a mounted flag, because the second effect run
reuses the same component instance. A logout that fails — for example because the end session
endpoint is unreachable — is logged instead of rejected, because the provider has already dropped the
local session at that point.

## Build time configuration

Vite inlines every `VITE_*` variable into the bundle, so the configuration is fixed when the image is
built. `frontend/Dockerfile` declares the variables as `ARG`s and `docker-compose.yml` forwards them
from the root `.env`:

```yaml
frontend:
  build:
    context: ./frontend
    args:
      VITE_AUTH_MODE: ${VITE_AUTH_MODE:-oidc}
      VITE_OIDC_AUTHORITY: ${VITE_OIDC_AUTHORITY:-}
```

Consequences worth keeping in mind:

- A change to any `VITE_*` variable requires `docker compose up -d --build frontend`; a plain restart
  keeps the old bundle.
- Both auth providers end up in the bundle, so the marker of an `oidc` build is the inlined
  authority. `scripts/smoke.ps1` verifies that the deployed bundle carries the realm issuer, and
  `-ExpectAuthMode dev|oidc` asserts a specific mode.
- If the application cannot even render, for example because the image was built in `oidc` mode
  without OIDC settings, `ErrorBoundary` catches the failure of the first render and `StartupError`
  explains it instead of leaving an empty page; the same reason is still logged to the console.

## Theme

`sap_horizon` by default, switchable to `sap_horizon_dark` from the shell bar. The choice is stored
in `localStorage` under `user-kit:theme` and applied through `setTheme()` of
`@ui5/webcomponents-base`. `ThemeStore` is a plain external store and `ThemeSwitchButton` subscribes
to it with `useSyncExternalStore`, so the store itself stays free of React and is tested directly.

## Icons

`main.tsx` imports `@ui5/webcomponents-icons/dist/AllIcons.js`, which registers a loader for the
`SAP-icons-v4` and `SAP-icons-v5` collections. Without that import every `ui5-icon` and every icon a
component renders internally logs `No loader registered for the SAP-icons-v5 icons collection` and
renders an empty box, because the collections are shipped as separate JSON assets. `vitest.setup.ts`
imports the same module for the same reason.

The collections are dynamic imports, so they are not part of the initial payload: Vite emits one
lazy chunk per collection (roughly 760 kB for v5 and 400 kB for v4, minified) that is fetched the
first time an icon renders. To slim the application down, replace the `AllIcons.js` import with the
icons actually used:

```ts
import '@ui5/webcomponents-icons/dist/folder.js';
import '@ui5/webcomponents-icons/dist/group.js';
```

That variant only works when every icon a component needs is imported too, which is why the template
prefers the complete collection.

## Icon names

The shipped collections contain 705 icons and are a subset of the full SAP icon font: `log-in`,
`log-out` and `moon` do **not** exist, and requesting them logs `Required icon is not registered.
Invalid icon name: <name>` and renders nothing. All names the application uses are therefore
collected in `src/shared/ui/icons/icons.ts` and typed as `IconName`, so a typo is a compile error and
`src/shared/ui/icons/icons.test.ts` resolves every entry against both `SAP-icons-v5` and
`SAP-icons-v4`, the latter because a legacy theme family renders the v4 collection. That test also
checks the icons that components render internally (`ui5-input`, `ui5-table`, `ui5-message-strip`,
`ui5-file-uploader`, `ui5-shellbar`).

When a name is needed, verify it against the collection instead of guessing:

```bash
node -e "const j=require('./node_modules/@ui5/webcomponents-icons/dist/generated/assets/v5/SAP-icons.json');
console.log(Object.keys(j.data).filter((n) => n.includes('log')).join(', '))"
```

| Purpose           | Name          |
| ----------------- | ------------- |
| Login             | `key`         |
| Logout            | `away`        |
| Light theme       | `light-mode`  |
| Dark theme        | `dark-mode`   |
| Documents / users | `folder`, `group` |
| Refresh           | `refresh`     |
| Upload / download | `upload`, `download` |
| Delete            | `delete`      |

## Build and container

`npm run build` type checks and writes `dist/`. The Docker image builds with `node:22-alpine` and
serves the result with `nginx:1.27-alpine`:

- `index.html` is sent with `Cache-Control: no-store`,
- `/assets/` is cached for one year with `immutable`,
- unknown paths fall back to `index.html` for client side routing,
- a `HEALTHCHECK` verifies that the server answers.

Vite prints a warning because the entry chunk exceeds the default 500 kB chunk limit: it contains
React, the UI5 React wrappers and the components the shell uses. The icon collections are already
split into lazy chunks. Raise `build.chunkSizeWarningLimit` in `vite.config.ts` if the warning is
noise for your pipeline.

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

`npm run check` is the gate for a commit. `eslint.config.mjs` is a flat config and adds the project
specific rules on top of `js.configs.recommended`, `typescript-eslint`, `sonarjs/recommended` and
`eslint-plugin-prettier/recommended`:

| Rule group | What it protects |
| --- | --- |
| `no-restricted-imports` per FSD layer | no import into a higher or equal layer, no deep import into a slice |
| `no-restricted-imports` with `../../*` | a slice stays self contained, relative imports reach one level up at most |
| `import-x/order`, `import-x/no-cycle` | stable import order, no cycles between slices |
| `import-x/resolver-next` | resolution through `tsconfig.json`, so the `@/*` alias is understood |
| `react.configs.flat.recommended`, `jsx-runtime` | component rules without the obsolete `prop-types` |
| `react-hooks` recommended latest | hook dependencies, the rules of the compiler |
| `sonarjs/recommended` | duplication, complexity, common bug patterns |

Rules that are switched off on purpose:

| Rule | Reason |
| --- | --- |
| `sonarjs/void-use` | `void somePromise()` is how this code base marks a deliberately un-awaited promise |
| `sonarjs/no-clear-text-protocols` in tests | the tests talk to `http://localhost` style URLs |
| `@typescript-eslint/explicit-function-return-type` in `.tsx` | a component returns JSX, which the annotation would only repeat; it stays on for plain `.ts` |
| `react-hooks/refs`, `react-hooks/purity`, `react-hooks/set-state-in-effect` | the UI5 wrappers are imperative by nature: refs, the external stores and the effects that subscribe to them are deliberate |

`sonar-project.properties` points SonarQube at `src/`, excludes `**/index.ts` (re-exports only) and
reads `coverage/lcov.info`.

## Tests

```bash
npm test              # 286 tests in 36 files
npm run test:coverage # V8 coverage, writes text, html and lcov reports
```

Components are tested with Testing Library: render the component, query by role or by test id, and
fire the events UI5 emits. Nothing reaches into a `ref` of a component, and no test asserts on the
internal state of a UI5 element beyond the properties the application sets.

| File | Focus |
| --- | --- |
| `src/app/App.test.tsx` | login screen, shell, routing and the role based navigation of a running application |
| `src/app/model/useAppServices.test.ts` | services of a configuration, reused while it stays the same |
| `src/app/ui/ErrorBoundary.test.tsx`, `src/app/ui/StartupError.test.tsx` | failure of the first render |
| `src/entities/user/model/roles.test.ts` | claim layouts, case handling, unknown roles |
| `src/entities/user/api/userApi.test.ts` | `$select`, `$filter`, `$orderby`, paging |
| `src/entities/file/api/fileApi.test.ts` | upload, download, delete |
| `src/features/auth/model/createAuthProvider.test.ts` | provider selection per auth mode |
| `src/features/auth/dev/devAuthProvider.test.ts` | dev token request and logout |
| `src/features/auth/oidc/oidcAuthProvider.test.ts` | callback, silent renew, return url |
| `src/features/auth/ui/AuthSession.test.tsx` | restore, logout, `StrictMode` double effect |
| `src/features/file-download/model/downloadBlob.test.ts` | object URL and revocation |
| `src/features/file-upload/ui/UploadDialog.test.tsx` | fields, disabled confirm button, reset |
| `src/features/user-role/ui/RoleSelect.test.tsx` | role change without a duplicated event |
| `src/features/theme-switch` | theme store and the shell bar item |
| `src/features/locale-switch/ui/LocaleSwitchButton.test.tsx` | language switch |
| `src/shared/api/http.test.ts` | headers, error mapping, timeout |
| `src/shared/api/odata/query.test.ts` | option building, encoding, property allow list |
| `src/shared/api/odata/odataClient.test.ts` | URLs, value wrapping, `$expand` |
| `src/shared/config/config.test.ts` | environment parsing and validation |
| `src/shared/i18n/i18n.test.ts` | interpolation, plurals, fallback to `ru` and to the key |
| `src/shared/lib/async/useAsyncTask.test.tsx` | loading, result, failure, discarded runs |
| `src/shared/lib/format/format.test.ts` | byte size, dates, initials |
| `src/shared/lib/message` and `src/shared/ui/Message.test.tsx` | design of a message |
| `src/shared/lib/router/hashRouter.test.ts`, `useRoute.test.tsx` | hash parsing, navigation, subscription |
| `src/shared/ui/icons/icons.test.ts` | every application icon exists in the v4 and v5 collections |
| `src/widgets/app-shell` | navigation entries, shell bar, profile menu |
| `src/widgets/documents-table/ui/DocumentsTable.test.tsx` | rows, empty state, download and delete |
| `src/widgets/users-table/ui/UsersTable.test.tsx` | rows, empty state, role change |
| `src/pages/documents/ui/DocumentsPage.test.tsx` | search, sorting, upload, delete |
| `src/pages/login/ui/LoginPage.test.tsx` | sign in, failure, dev mode warning |
| `src/pages/users/ui/UsersPage.test.tsx` | role update and its message |

### Testing UI5 components

`vitest.setup.ts` carries everything the UI5 web components need under `happy-dom`:

- it imports the icon collections, otherwise every icon logs a missing loader,
- it patches `_scrollElementIntoView` of `ui5-table`, because the component calls it while a cell
  receives the focus and `happy-dom` never renders the header row it reads; without the patch an
  empty table reports an unhandled rejection,
- it calls `cleanup()` after every test, because Testing Library only does that automatically when it
  finds a global `afterEach`, and this project imports the hooks from `vitest` explicitly.

Two more rules keep the suite quiet and deterministic:

- every UI5 package is inlined into Vite (`server.deps.inline` in `vite.config.ts`). Node would
  otherwise load a second copy of the icon registry and fail to load the JSON of the collections,
- a test that needs to *set* a UI5 value dispatches the event UI5 itself would dispatch
  (`new CustomEvent('change', { bubbles: true, detail })`) instead of poking the element.
