# AGENTS.md — games

Next.js 16.4 (Turbopack), React 19.3, antd 6, three.js 0.186, Phaser 4. Пакетный менеджер — **pnpm**
(`pnpm-workspace.yaml` в корне проекта). Домен в стенде: `https://user-kit.games.local`.

Отдельный проект-browserless: сюда вынесены игры, которые раньше жили в `frontend-main`
(`features/lines` и `features/match3`). Проект **не** ходит в API бэкенда, не имеет сессии и
не требует входа — состояния игр (настройки, статистика) лежат в `localStorage` браузера.
Заготовки нереализованных игр (шахматы, шашки) остались в `frontend-main` как страницы-заглушки.

## Структура

```
src/
├── app/
│   ├── layout.tsx, providers.tsx, globals.css   # AntdRegistry, ConfigProvider ru_RU
│   ├── page.tsx                                 # каталог игр (ссылки на /lines и /match3)
│   ├── lines/page.tsx, match3/page.tsx          # обёртки dynamic(..., { ssr: false })
├── features/
│   ├── lines/        game (engine, board на three.js), ui
│   └── match3/       game (rules, scene на Phaser), model, ui
├── shared/lib/logger.ts   серверный Pino-логгер (формат бэкенда, см. vector/vector.toml)
└── instrumentation.ts     старт сервера и ошибки рендера (Next hooks)
```

Алиас `@/*` → `src/*`. Структура повторяет Feature Sliced Design
(`app → features → shared`), но жёстких правил границ в ESLint здесь нет — соблюдай их вручную:
`features` знает только про `shared`, `shared` не знает ни о ком.

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
- **Диалоги и модалки игр — на тёмном фоне** (`DARK_MODAL_STYLES` в `features/lines/ui/modalTheme.ts`),
  это осознанное требование.
- **Музыка без ассетов**: звук синтезируется Web Audio (`features/lines/ui/sound.ts`), фоновая
  музыка — плейлист транс-этюдов (`ui/musicPlaylist.ts`) без аудиофайлов; треки идут по очереди,
  после последнего круг повторяется.
- **Логи** пишет `shared/lib/logger` (Pino): строка в формате бэкенда
  `[LEVEL]-[yyyy-MM-dd HH:mm:ss.SSS]- message` (UTC), в stdout и в `LOG_FILE` (`games.log`
  в compose), уровень — `LOG_LEVEL`. Формат строки разбирает `vector/vector.toml` — форма
  меняется только вместе с ним.
- Комментарии и JSDoc — на русском.

## Связь с frontend-main

Ссылки на игры из меню `frontend-main` ведут на этот домен: `widgets/app-shell/model/navigation.ts`
берёт базовый адрес из `appConfig.gamesBaseUrl` (`NEXT_PUBLIC_GAMES_BASE_URL`, по умолчанию
`https://user-kit.games.local`). Меню само по себе не проверяет права — любой желающий может
открыть игры напрямую, токенов и ролей здесь нет.

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
интерфейс — puppeteer'ом против задеплоенного `https://user-kit.games.local/lines`
(в headless Chrome нужен `--ignore-certificate-errors`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
