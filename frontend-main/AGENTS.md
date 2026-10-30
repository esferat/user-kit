<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — frontend-main

Next.js 16.4 (Turbopack), React 19.3, antd 6. Пакетный менеджер — **pnpm**
(`pnpm-workspace.yaml` в корне проекта). Домен в стенде: `https://user-kit.next.local`.

Приложение уже **не** стоковый `create-next-app`: есть профиль, редактирование профиля
и админка. Игры (match-3 и «Цветные линии») вынесены в отдельный проект [`games/`](../games/),
здесь от них остались только заготовки-заглушки (шахматы, шашки) и пункты меню со
ссылками на домен игр.

## Структура

```
src/
├── app/
│   ├── layout.tsx, providers.tsx, globals.css     # AntdRegistry, шрифты, ConfigProvider ru_RU
│   ├── login/page.tsx
│   └── (protected)/                                # оболочка ProtectedAppShell
│       ├── layout.tsx, profile/, profile/edit/, admin/
│       └── games/{chess,checkers}/page.tsx         # заглушки, ссылки на games/ — в меню
├── features/
│   └── auth/          api, model, ui                # сессия, логин, store
├── entities/user/     model (types, roles)
├── shared/            api (http-клиент), config, lib (initials, message, remote — Module Federation)
├── instrumentation.ts  старт сервера и ошибки серверных запросов (Next hooks)
└── widgets/app-shell/ model (navigation), ui
```

`shared/lib/logger.ts` — серверный логгер Pino: строка в формате бэкенда
`[LEVEL]-[yyyy-MM-dd HH:mm:ss.SSS]- message` (UTC) в stdout и в `LOG_FILE`. Модуль **не выведен** из
`shared/lib/index.ts` и импортируется только серверными файлами (`src/instrumentation.ts` и подобными)
прямым путём — иначе `node:fs` попадёт в клиентский граф импортов. `LOG_LEVEL` задаёт уровень
(по умолчанию `info`). Формат строки разбирает `vector/vector.toml` — форма меняется только вместе с
ним.

Алиас `@/*` → `src/*`. Структура повторяет Feature Sliced Design
(`app → widgets → features → entities → shared`), но жёстких правил границ в ESLint здесь нет —
соблюдай их вручную: `features` знает только про `entities` и `shared`, `widgets` — про `features`
и ниже, `shared` не знает ни о ком.

## Правила

- **Игры живут в проекте [`games/`](../games/)**: работоспособные `lines` и `match3` отсюда
  убраны, остались только заглушки `/games/chess` и `/games/checkers`. Пункты меню «Три в ряд»
  и «Цветные линии» — абсолютные ссылки на `appConfig.gamesBaseUrl`
  (`NEXT_PUBLIC_GAMES_BASE_URL`, по умолчанию `https://user-kit.games.local`); `AppShell`
  открывает такие ключи через `window.location.assign`, а не `router.push`.
- **`react-hooks/set-state-in-effect` запрещён** (правило react-hooks): нельзя синхронно вызывать
  `setState` в теле эффекта — откладывай через `setTimeout`/`requestAnimationFrame`.
- **Стили — CSS-модули** рядом с компонентом. Правила antd перебиваются удвоением класса
  (`.класс.класс`), а internals — через `:global(...)`.
- **API** — через `shared/api/http.ts`; `NEXT_PUBLIC_API_BASE_URL` пустой = same-origin
  (nginx проксирует `/api` на бэкенд). Сессия в cookie, токенов в браузере нет.
- **Микрофронтенд `user-profile`** подключён через Module Federation: `shared/lib/remote.ts`
  делает `init` (remote `user_profile`, entry — `mf-manifest.json` с `NEXT_PUBLIC_PROFILE_BASE_URL`)
  и грузит expose'ы: `loadProfileEdit` (`/profile/edit`), `loadProfilePage` (`/profile`, навигация
  к правке задаётся колбэком `onEdit` — remote не знает роутера Next) и `loadProfileAvatar`
  (аватар в шапке меню; пока remote не подключился или недоступен, рисуется локальная плашка с
  инициалами на данных сессии). React, ReactDOM **и `react-dom/client`** регистрируются
  в share scope как singleton с `lib` — без этого у компонента remote свой экземпляр React и хуки
  падают, а `react-dom/client` пришлось бы шарить отдельным ключом: точный ключ `react-dom` sub-path
  не покрывает, и remote собрал бы свою копию, которая спорит со вшитым в Next canary React
  («Incompatible React versions», module-federation/core#4727). Стратегия выбора провайдера —
  явный `shareStrategy: 'loaded-first'` в `init`: уже загруженный экземпляр хоста важнее версии.
  Импорты в `remote.ts` ленивые,
  чтобы серверный бандл не трогал `react-dom/client`. Грузится компонент только на клиенте, сбой
  загрузки показывается `Alert`'ом на `/profile/edit`.
  antd не шарится намеренно — remote собирает свою копию.
- **Логи** пишет `shared/lib/logger` (Pino): строка в формате бэкенда
  `[LEVEL]-[yyyy-MM-dd HH:mm:ss.SSS]- message` (UTC), в stdout и в `LOG_FILE`, уровень — `LOG_LEVEL`.
  Падения серверных запросов ловит `onRequestError` в `src/instrumentation.ts`, который подключает
  логгер динамически и только в Node-runtime. Ошибки, которые пользователь видит в UI, в лог не
  дублируются — доступ-лог остаётся за nginx.
- Комментарии и JSDoc — на русском.

## Команды

```bash
pnpm install
pnpm dev        # http://localhost:3000 (Turbopack)
pnpm build      # включает проверку типов; output: standalone → node server.js в Docker
pnpm lint
```

Docker-образ собирается из этого же каталога и запускает `node server.js` (standalone).
`next.config.ts` включает `cacheComponents`, `partialPrefetching` и `reactCompiler` — не отключай
их без чтения локальной документации Next.
