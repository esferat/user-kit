# Бриф для агента — fullstack-next

Полноценное Next.js-приложение монорепозитория на `https://user-kit.next.local`. Правила кода — в
[`../AGENTS.md`](../AGENTS.md), контракт с бэкендом и контракты игр — в
[`contract_map_v1.md`](contract_map_v1.md), общий обзор фронтендов — в
[`../../docs/frontend.md`](../../docs/frontend.md).

## Что это

Next.js 16.4 (App Router, Turbopack, React Compiler), React 19.3, antd 6, three.js 0.186,
Phaser 4. Пакетный менеджер — **pnpm** (`pnpm@12.10.1`, `packageManager` в `package.json`).

Приложение уже не стоковый `create-next-app`: публичный лендинг, вход, личный кабинет, правка
профиля с аватаром, раздел администратора и четыре игры. Это **не** BFF: Next не проксирует API и
не хранит токенов — браузер ходит в бэкенд напрямую (same-origin через nginx), авторизация — на
`httpOnly`-cookie бэкенда.

## Состояние на 2026-10-23

| Проверка | Результат |
| --- | --- |
| `pnpm lint` | чисто |
| `pnpm build` | успешно: 10 маршрутов + Proxy (Middleware), все страницы статические |
| Тесты | **нет** ни одного теста в пакете |
| Реализовано | лендинг, вход (OIDC/dev), сессия, профиль, правка профиля и аватар, меню/навигация, match-3 (Phaser), «Цветные линии» (three.js) |
| Заготовки | `/admin` — экран-заглушка без операций, `/games/chess`, `/games/checkers` — `Result` «игра ещё не реализована» |

`pnpm build` печатает предупреждение Next.js: установленная `16.4.0` затронута известной
уязвимостью и предлагает `next upgrade`. Версия зафиксирована правилами репозитория — обновление
только по явной просьбе пользователя.

## Стек

| Пакет | Версия | Роль |
| --- | --- | --- |
| `next` | 16.4.0 | App Router, Turbopack, `proxy.ts` |
| `react`, `react-dom` | 19.3.0 | UI |
| `antd`, `@ant-design/nextjs-registry` | 6.6.x, 1.3.x | компоненты и SSR-стили antd |
| `three` | 0.186.1 | «Цветные линии» |
| `phaser` | 4.2.x | match-3 |
| `babel-plugin-react-compiler` | 1.0.0 | React Compiler |
| `eslint` + `eslint-config-next` | 9.x, 16.4.0 | линт |

`next.config.ts`: `cacheComponents`, `partialPrefetching`, `reactCompiler`, `output: 'standalone'`.
Все четыре флага влияют на код: см. «Грабли».

## Карта кода

```
src/
├── proxy.ts                     optimistic-защита маршрутов по cookie (Next 16 middleware)
├── app/
│   ├── layout.tsx               html/body, AntdRegistry, Suspense, Providers, AppShell
│   ├── providers.tsx            ConfigProvider(ru_RU) + AntApp + AuthSessionProvider
│   ├── page.tsx                 публичный лендинг `/`
│   ├── login/page.tsx           Suspense + LoginScreen (useSearchParams)
│   └── (protected)/
│       ├── layout.tsx           ProtectedAppShell (редирект при истёкшей сессии)
│       ├── profile/page.tsx     карточка профиля
│       ├── profile/edit/        форма правки + аватар
│       ├── admin/page.tsx       заглушка admin-раздела
│       └── games/{chess,checkers,match3,lines}/page.tsx
├── widgets/app-shell/           AppShell (шапка + боковое меню), navigation.ts
├── features/
│   ├── auth/                    cookie-провайдер, SessionStore, LoginScreen, ProfileMenu
│   ├── profile-edit/            ProfileEditForm, profileApi
│   ├── match3/                  Phaser-игра
│   └── lines/                   three.js-игра
├── entities/user/               AuthenticatedUser, MeResponse, роли, ProfileCard
└── shared/
    ├── api/http.ts              request/requestJson, ApiError, CSRF, joinUrl
    ├── config/config.ts         NEXT_PUBLIC_API_BASE_URL → appConfig
    └── lib/                     format, message, initials
```

Импорты — через alias `@/*` → `./src/*`. Раскладка повторяет FSD (`app → pages → widgets →
features → entities → shared`), но, в отличие от Vite-приложений, **не проверяется ESLint**:
границы держи руками.

## Как устроен запрос

```
Браузер → nginx (user-kit.next.local)
        → Next: proxy.ts (есть cookie UK_SESSION/UK_DEV_TOKEN? иначе /login)
        → App Router: layout → Providers → AppShell → (protected)/page
        → клиентские компоненты: useAuth() / createProfileApi()
        → fetch('/api/v1/...', credentials: 'include' + X-XSRF-TOKEN)
        → backend (Spring Boot)
```

- `proxy.ts` — только UX: он смотрит **наличие** cookie и не проверяет её валидность. Если cookie
  протухла, `GET /api/v1/me` вернёт 401, `SessionStore` станет `anonymous`, а `ProtectedAppShell`
  сделает `router.replace('/login')`.
- `SessionStore` — внешний store для `useSyncExternalStore`; `restore` идёт один раз на store, что
  защищает от двойного запроса в `StrictMode`. Статусы: `restoring → anonymous |
  authenticated | error`.
- `CookieAuthProvider` кэширует `GET /api/v1/auth/config` на время вкладки, при `oidc` уходит
  навигацией на `/api/v1/auth/login` (fetch не подходит: нужен `302` + `Set-Cookie`), при `dev`
  вызывает `POST /api/v1/auth/dev-login`.
- Аватар приходит путём (`/api/v1/me/avatar?v=…`); провайдер склеивает его с `apiBaseUrl`, чтобы
  работать и на другом origin.

## Игры

| Игра | Технология | Состояние |
| --- | --- | --- |
| «Три в ряд» (`/games/match3`) | Phaser 4 | работает: поле 10×10, 4/5/6 цветов, радужный/молния/бомба, каскады, счёт в памяти; таблица лидеров — мок |
| «Цветные линии» (`/games/lines`) | three.js | работает полностью: 4 сложности, предсказание, бонусный ход, подсказка, звук, настройки и лучшие попытки в `localStorage` |
| Шахматы, шашки | — | страницы-заглушки |

Обе игры грузятся через `dynamic(..., { ssr: false })`: Phaser и three.js требуют DOM и не должны
попадать в серверный рендер.

«Цветные линии» разделены на слои:

```
features/lines/
├── game/engine.ts        чистые правила (без three.js): createGame, findPath, findHint, applyMove
├── game/board.ts         сцена three.js + анимации (requestAnimationFrame)
├── game/{tiles,balls,plants}.ts  геометрия и материалы
├── game/settingsStorage.ts, statsStorage.ts  localStorage-контракты
├── ui/LinesGame.tsx      состояние партии, звук, диалоги
├── ui/components/*.tsx   TopBar, GameBoard, NextBalls, AttemptsPanel, SettingsModal, RulesModal
├── ui/sound.ts           Web Audio: музыка и эффекты без ассетов
└── ui/modalTheme.ts      DARK_MODAL_STYLES для всех диалогов
```

Правила движка не зависят от рендера — поэтому их можно проверять без браузера. Тестов в
репозитории нет; исторически движок проверяли временными harness'ами на esbuild + puppeteer.

## Команды

```bash
pnpm install
pnpm dev         # http://localhost:3000
pnpm lint        # eslint
pnpm build       # next build: typecheck + генерация типов маршрутов
pnpm start       # production-сервер из .next (без standalone-копии)
```

Своего прокси у Next нет (в `next.config.ts` нет `rewrites`): в compose `/api` заворачивает nginx,
а при локальном запуске без edge задай `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080` и добавь
`http://localhost:3000` в `CORS_ALLOWED_ORIGINS` бэкенда. Пустое значение (по умолчанию) означает
same-origin.

В compose приложение собирается в standalone-образ (`node:22-alpine`, `node server.js`,
непривилегированный `nextjs`), `NEXT_PUBLIC_API_BASE_URL` передаётся build-arg'ом из
`VITE_API_BASE_URL` (общая переменная монорепозитория, по умолчанию пусто = same-origin).

## Правила и грабли

1. **Это Next 16, а не тот Next, который «в памяти».** Перед правкой маршрутов, кэша и метаданных
   читай `node_modules/next/dist/docs/`. `proxy.ts` — новое имя middleware; `LayoutProps<"/">`,
   `PageProps` генерируются в `.next/types` (типы появляются после `next dev`/`next build`).
2. **`cacheComponents: true`.** Значения, вычисляемые при пререндере (например, `Math.random()` в
   `AntdRegistry`), запрещены — поэтому в `layout.tsx` дерево обёрнуто в `<Suspense>`.
   `useSearchParams` в клиентском компоненте обязан быть под `<Suspense>` (см. `/login`).
3. **`reactCompiler: true`** — не пиши ручных `useMemo`/`useCallback` «для оптимизации» без нужды и
   не мутируй пропсы; компилятор опирается на чистоту рендера.
4. **Правило линта `react-hooks/set-state-in-effect`**: `setState` в `useEffect` выносится в
   `setTimeout(..., 0)` (см. чтение `localStorage` в `LinesGame`), иначе линт падает.
5. **Никаких токенов.** Только `credentials: 'include'` и `X-XSRF-TOKEN` из читаемой cookie
   `XSRF-TOKEN`; `Authorization` не ставится никогда.
6. **`NEXT_PUBLIC_*` инлайнится на сборке** — после правки переменной нужен
   `docker compose up -d --build fullstack-next`.
7. **Страницы — клиентские** (`'use client'`), серверных данных нет; серверные обёртки — только
   `layout.tsx` и `/login`. Не добавляй `fetch` в серверные компоненты без явной задачи.
8. **Диалоги и модалки игр — на тёмном фоне** (`DARK_MODAL_STYLES`), это осознанное требование.
9. **Стили игр — CSS-модули** (`LinesGame.module.css`), инлайновые стили в match-3 — исключение,
   не образец.
10. **Комментарии — на русском.**

## Ограничения и долги

- `/admin` не управляет пользователями: это заглушка. Реальные операции — в `frontend-antd`/
  `frontend-mui`; бэкенд-эндпоинты `/api/v1/users` есть.
- `features/lines/game/board-old.ts` — мёртвый файл, никто его не импортирует. Удаление — только
  после подтверждения пользователя.
- Игр нет в тестах; любая правка движка проверяется вручную в браузере.
- Статистика «Цветных линий» живёт только в `localStorage` (`lines:stats`), на сервер не уходит.
- `ProfileEditForm` предлагает WebP (`accept`), но бэкенд декодирует ImageIO и отвергает WebP.
- Шахматы и шашки — заглушки, хотя пункты меню уже есть.
- `build` предупреждает об уязвимости в Next 16.4.0; обновление — отдельная задача с согласия
  пользователя.
