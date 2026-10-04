# Frontend

## Stack

| Package | Version | Purpose |
| --- | --- | --- |
| `vite` | 8.x | build and dev server |
| `typescript` | 5.9 | strict type checking, no emit |
| `vitest` | 5.x | unit tests with `happy-dom` |
| `@ui5/webcomponents`, `@ui5/webcomponents-fiori` | 2.27 | Fiori components |
| `oidc-client-ts` | 3.x | OIDC Authorization Code + PKCE |
| `eslint`, `typescript-eslint`, `eslint-plugin-import-x`, `eslint-plugin-sonarjs` | 9.x / 8.x / 4.x / 3.x | linting, import rules, SonarJS rules |
| `prettier`, `eslint-plugin-prettier` | 3.x / 5.x | formatting, enforced through ESLint |

The interface is bilingual, Russian (`ru`) and English (`en`), see [Localization](#localization). The
code, comments, API and documentation are English.

## Why Web Components and not XML views

SAPUI5 applications are built with the [UI5 CLI](https://ui5.github.io/cli/v4), which compiles
`*.view.xml` into JavaScript and resolves views through a module loader at runtime. Reproducing that
pipeline inside a plain Vite build is not supported, and mixing both toolchains in one repository is
a known source of build issues.

The application therefore renders the same Fiori 3 components from
`@ui5/webcomponents`: `ShellBar`, `SideNavigation`, `Table`, `Dialog`, `FileUploader`,
`MessageStrip`, `Toolbar`, `Input`, `Select` and others. The result is a standard TypeScript project
that builds, tests and deploys like any other Vite application while looking like SAPUI5.

If a real SAPUI5 runtime is required, keep the backend as it is and replace the `frontend/` folder
with a UI5 CLI project that consumes the same OData and REST endpoints.

## Structure

The sources follow [Feature Sliced Design](https://feature-sliced.design): layers may only import
from the layers below them, and every cross slice import goes through the public API of the target
slice (`@/shared/api`, never `@/shared/api/http`). ESLint enforces both rules, see
[Code quality](#code-quality).

```
frontend/src/
├── app/                        composition root: bootstrap, page registry, startup error
├── pages/                      documents, login, users — one slice per route
│   ├── documents/
│   ├── login/
│   └── users/
├── widgets/                    large blocks: app shell, tables
│   ├── app-shell/
│   ├── documents-table/
│   └── users-table/
├── features/                   user facing capability, can be switched on and off
│   ├── auth/                   OIDC and dev providers, factory
│   ├── file-download/
│   ├── file-upload/
│   ├── locale-switch/
│   ├── theme-switch/
│   └── user-role/
├── entities/                   business data and the operations on it
│   ├── file/
│   └── user/
└── shared/                     infrastructure reused by everything above
    ├── api/                    http wrapper, OData query builder, DTOs
    ├── config/                 typed access to VITE_* variables with validation
    ├── i18n/                   translator, dictionaries
    ├── lib/                    dom helpers, formatting, hash router
    └── ui/                     icon registry
```

A slice looks like this, every folder exports through `index.ts`:

```
src/widgets/documents-table/
├── index.ts                    export * from './ui/documentsTable'
├── ui/documentsTable.ts        the table
└── model/documentsColumns.ts   columns, formats, cell templates
```

Consequences worth keeping in mind:

- `app` is the only layer that knows every other layer; a widget must not import a page.
- `shared` must not import from `entities`, `features`, `widgets` or `pages`.
- A page may be reused by another page only through its public API.

## Routing

The router is hash based and dependency free (`src/shared/lib/router/hashRouter.ts`):

| Route | Page | Access |
| --- | --- | --- |
| `#/documents` | file list, upload, download, rename, delete | `user`, `admin` |
| `#/admin-users` | account administration, roles, activation | `admin` |

The navigation entries are filtered by role, and the shell resolves every hash against the routes the
current user may open. An unknown or forbidden hash falls back to the first allowed route, so a
crafted URL never renders content the user is not entitled to. `navigate()` suppresses the duplicate
`hashchange` event, so a route is rendered exactly once. The router itself also understands
parameters (`#/documents/42`), which the shell currently does not use: file details open as a dialog
inside the documents page.

## API client

`createApiClient({ baseUrl, getAccessToken })` returns an object with the operations of the backend:
`me()`, `listFiles()`, `upload()`, `download()`, `remove()`, `updateFile()`, `listUsers()`,
`updateUser()`, `odataMetadata()`. All calls share the fetch wrapper (`src/shared/api/http.ts`), which

- prefixes `baseUrl` (empty means same origin),
- adds `Authorization: Bearer …` when a token exists,
- sets `Accept: application/json` and `Content-Type` for bodies,
- maps error responses to `ApiError` with `status`, `code` and `message`,
- aborts after a configurable timeout.

`src/shared/api/odata/query.ts` never concatenates raw strings: property names are checked against an
allow list and literal values are encoded, so a filter can only be built from known properties.

## Localization

`src/shared/i18n` holds a small translator instead of a full i18n framework: two dictionaries of flat
dotted keys, `{placeholder}` interpolation and CLDR plural forms.

```ts
const t = i18n.t;
t('documents.filesCount', { count: 42 });   // "42 файла"
t('documents.title');                        // "Файлы"
```

| Part | Purpose |
| --- | --- |
| `locales/ru.ts`, `locales/en.ts` | the dictionaries, one flat object per language |
| `i18n.ts` | `createI18n()` with `t`, `locale`, `availableLocales`, `setLocale` |
| `index.ts` | the singleton used by the application |

- The initial locale comes from `VITE_DEFAULT_LOCALE`, the choice of the user is stored in
  `localStorage` under `user-kit:locale` and wins over it.
- Every lookup sets `document.documentElement.lang`, so the UI5 components format dates and numbers in
  the same language.
- Plural forms use the `one`, `few`, `many` and `other` categories of the language: Russian needs all
  four, English only `one` and `other`.
- A missing key falls back to `ru` and finally to the key itself, so an incomplete translation shows
  the key instead of an empty screen.
- The switch in the shell bar (`src/features/locale-switch`) re-renders the current route, because the
  labels are read while the page is built.

## Authentication modes

| `VITE_AUTH_MODE` | Behaviour |
| --- | --- |
| `oidc` | Redirect to Keycloak, PKCE, session in `sessionStorage`, renew on expiry |
| `dev` | `GET /api/v1/dev/token?role=…` once at start, token in memory |

`assertConfigured()` fails fast with a readable message when `VITE_AUTH_MODE=oidc` is selected
without `VITE_OIDC_AUTHORITY` and `VITE_OIDC_REDIRECT_URI`, instead of failing later during login.


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
  without OIDC settings, `main.ts` catches the startup failure and renders a readable error page
  instead of an empty screen; the same message is still logged to the browser console.

## Theme

`sap_horizon` by default, switchable to `sap_horizon_dark` from the shell bar. The choice is stored
in `localStorage` under `user-kit:theme` and applied through `setTheme()` of
`@ui5/webcomponents-base`.

## Icons

`main.ts` imports `@ui5/webcomponents-icons/dist/AllIcons.js`, which registers a loader for the
`SAP-icons-v4` and `SAP-icons-v5` collections. Without that import every `ui5-icon` and every icon a
component renders internally logs `No loader registered for the SAP-icons-v5 icons collection` and
renders an empty box, because the collections are shipped as separate JSON assets.

The collections are dynamic imports, so they are not part of the initial payload: Vite emits one
lazy chunk per collection (roughly 740 kB for v5 and 390 kB for v4, minified) that is fetched the
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
| Language          | `language`    |

## Build and container

`npm run build` type checks and writes `dist/`. The Docker image builds with `node:22-alpine` and
serves the result with `nginx:1.27-alpine`:

- `index.html` is sent with `Cache-Control: no-store`,
- `/assets/` is cached for one year with `immutable`,
- unknown paths fall back to `index.html` for client side routing,
- a `HEALTHCHECK` verifies that the server answers.

Vite prints a warning because `index.js` exceeds the default 500 kB chunk limit; the Fiori component
chunks are already split. Raise `build.chunkSizeWarningLimit` in `vite.config.ts` if the warning is
noise for your pipeline.

## Code quality

```bash
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run check        # lint + format:check + typecheck + test
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
| `sonarjs/recommended` | duplication, complexity, common bug patterns |

Two Sonar rules are switched off on purpose: `sonarjs/void-use`, because `void somePromise()` is how
this code base marks a deliberately un-awaited promise, and `sonarjs/no-clear-text-protocols` in
tests, which talk to `http://localhost` style URLs. `sonar-project.properties` points SonarQube at
`src/`, excludes `**/index.ts` (re-exports only) and reads `coverage/lcov.info`.

## Tests

```bash
npm test              # 158 tests in 18 files
npm run test:coverage # V8 coverage, writes text, html and lcov reports
```

| File | Focus |
| --- | --- |
| `src/entities/user/model/roles.test.ts` | claim layouts, case handling, unknown roles |
| `src/entities/user/api/userApi.test.ts` | `$select`, `$filter`, `$orderby`, paging |
| `src/entities/file/api/fileApi.test.ts` | upload, download, delete, rename |
| `src/features/auth/model/createAuthProvider.test.ts` | provider selection per auth mode |
| `src/features/auth/dev/devAuthProvider.test.ts` | dev token request and logout |
| `src/features/theme-switch/model/themeStore.test.ts` | theme name, localStorage, document attribute |
| `src/features/locale-switch` | covered through the pages and the i18n tests |
| `src/shared/api/http.test.ts` | headers, error mapping, timeout |
| `src/shared/api/odata/query.test.ts` | option building, encoding, property allow list |
| `src/shared/api/odata/odataClient.test.ts` | URLs, value wrapping, `$expand` |
| `src/shared/config/config.test.ts` | environment parsing and validation |
| `src/shared/i18n/i18n.test.ts` | interpolation, plurals, fallback to `ru` and to the key |
| `src/shared/lib/dom/element.test.ts` | element factory, message strip, error messages |
| `src/shared/lib/format/format.test.ts` | byte size, dates, initials |
| `src/shared/lib/router/hashRouter.test.ts` | hash parsing, navigation, duplicate events |
| `src/shared/ui/icons/icons.test.ts` | every application icon exists in the v4 and v5 collections |
| `src/widgets/app-shell/model/navigation.test.ts` | role based visibility of navigation entries |
| `src/app/ui/startupError.test.ts`, `src/pages/login/ui/loginPage.test.ts` | login screen and error page |

