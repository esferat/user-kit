<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — fullstack-next

Next.js 16.4 (Turbopack), React 19.3, antd 6, three.js 0.186, Phaser 4. Пакетный менеджер — **pnpm**
(`pnpm-workspace.yaml` в корне проекта). Домен в стенде: `https://user-kit.next.local`.

Приложение уже **не** стоковый `create-next-app`: есть профиль, редактирование профиля,
админка и игры (шахматы, шашки, match-3, «Цветные линии»).

## Структура

```
src/
├── app/
│   ├── layout.tsx, providers.tsx, globals.css     # AntdRegistry, шрифты, ConfigProvider ru_RU
│   ├── login/page.tsx
│   ├── (protected)/                                # оболочка ProtectedAppShell
│   │   ├── layout.tsx, profile/, profile/edit/, admin/
│   │   └── games/{chess,checkers,match3,lines}/page.tsx
├── features/
│   ├── auth/          api, model, ui                # сессия, логин, store
│   ├── profile-edit/  api, ui
│   ├── match3/        game, model, ui               # Phaser
│   └── lines/         game, ui                      # three.js
├── entities/user/     model (types, roles), ui
├── shared/            api (http-клиент), config, lib (initials, message)
└── widgets/app-shell/ model (navigation), ui
```

Алиас `@/*` → `src/*`. Структура повторяет Feature Sliced Design
(`app → widgets → features → entities → shared`), но жёстких правил границ в ESLint здесь нет —
соблюдай их вручную: `features` знает только про `entities` и `shared`, `widgets` — про `features`
и ниже, `shared` не знает ни о ком.

## Правила

- **Игры грузятся только на клиенте**: страница игры — `dynamic(() => import(...), { ssr: false })`,
  потому что three.js/Phaser/Web Audio требуют браузера.
- **Логика игр отделяй от рендера**: чистые модули в `game/` (`engine.ts`, `rules.ts`, `*Storage.ts`)
  не импортируют three.js/React — их можно тестировать в Node. `board.ts`/`scene.ts` — только
  отображение и анимации.
- **`react-hooks/set-state-in-effect` запрещён** (правило react-hooks): нельзя синхронно вызывать
  `setState` в теле эффекта — откладывай через `setTimeout`/`requestAnimationFrame`.
- **Стили — CSS-модули** рядом с компонентом. Правила antd перебиваются удвоением класса
  (`.класс.класс`), а internals — через `:global(...)`.
- **Состояние игр** (настройки, статистика) — в `localStorage`, ключи в `game/*Storage.ts`
  (`lines:settings`, `lines:stats`); значения валидируются при чтении.
- **API** — через `shared/api/http.ts`; `NEXT_PUBLIC_API_BASE_URL` пустой = same-origin
  (nginx проксирует `/api` на бэкенд). Сессия в cookie, токенов в браузере нет.
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

Тестов в репозитории у игр нет: проверяй движок временным harness'ом на esbuild (node) и
интерфейс — puppeteer'ом против задеплоенного `https://user-kit.next.local/games/lines`
(в headless Chrome нужен `--ignore-certificate-errors`).
