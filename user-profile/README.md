# user-profile

Микрофронтенд для работы с профилем пользователя. Подключается в основное приложение
`frontend-main` через Module Federation, публикуется на собственном домене
`https://user-kit.profile.local` и собирается в Docker.

## Стек

| Область        | Технология                                                        |
| -------------- | ----------------------------------------------------------------- |
| Фреймворк      | Modern.js 3.10 (Rsbuild, React Router 7)                          |
| UI             | React 19.3, Ant Design 6.6                                        |
| Данные         | TanStack Query 5, react-hook-form 7, `@hookform/resolvers`, zod 4 |
| BFF            | `@modern-js/plugin-bff`, роуты в `api/lambda/*`                   |
| Микрофронтенды | `@module-federation/modern-js-v3` (producer, `user_profile`)      |
| Качество       | Rstack CLI (`rs lint`, `rs fmt`, `rs check`), SonarQube           |
| Слои           | Feature Sliced Design                                             |

Два замещения в исходном списке стека:

- **`next-safe-action` → `shared/lib/safeAction.ts`** — пакет зависит от `next`, а приложение
  собирается на Modern.js. Хелпер делает то же самое: zod-валидация входа, обработчик получает
  уже проверенное значение, наружу уходит один дискриминированный результат.
- **Prettier → `rs fmt`** — форматтер из Rstack, позиционируется как Prettier-compatible.
  Два форматтера конфликтовали бы, поэтому `prettier` в проекте нет.

## Структура

```
user-profile/
├── api/lambda/            BFF-роуты (сервер): profile.ts, profile/avatar.ts
├── shared/                общий слой FSD: config, lib, model, ui + серверный api/backend.ts
├── src/
│   ├── routes/            conventional routing: layout.tsx, page.tsx, profile/edit/page.tsx
│   ├── entities/user/     профиль: запрос, типы, Avatar, Card
│   ├── features/profile-edit/  форма правки (точка входа MF — index.tsx)
│   └── widgets/profile-shell/  оболочка локального экрана
├── modern.config.ts       порт, bff.prefix, assetPrefix, плагины
├── module-federation.config.ts  name, exposes, shared
└── Dockerfile             сборка → .output → node .output/index
```

Алиасы: `@/*` → `src/*`, `@shared/*` → `shared/*`, `@api/*` → `api/lambda/*`,
`@entities/*`, `@features/*`, `@widgets/*`.

## Как это работает

**BFF.** Браузер никогда не ходит в бэкенд напрямую: все вызовы идут на
`/profile-api/*` того же Origin. `shared/api/backend.ts` переносит cookie сессии в запрос к
`http://backend:8080` и поднимает `X-XSRF-TOKEN` из cookie `XSRF-TOKEN` для изменяющих методов.
Сессия остаётся httpOnly, токены в страницу не попадают.

**Валидация.** Схема `profileDetailsSchema` лежит в `shared/model` и используется в двух местах:
`zodResolver` в форме (клиент) и `safeAction` в BFF-роуте (сервер). Правило не расходится.

**Module Federation.** Проект — producer, три expose:
`{ './ProfilePage': './src/features/profile-view/index.tsx', './ProfileEdit': './src/features/profile-edit/index.tsx', './ProfileAvatar': './src/features/profile-avatar/index.tsx' }`.
Компонент самодостаточен — привозит свои `QueryClientProvider` и `ConfigProvider`, потому что
рендерится внутри `frontend-main`. Потребитель подключает remote через `@module-federation/runtime`.

**Конвенция `delete`.** Имя экспорта в BFF-роуте задаёт HTTP-метод, но `delete` нельзя:
генератор клиентской части выдаёт `export var delete` — ошибка синтаксиса. Поэтому роут
экспортирует `del`, серверная часть Modern.js читает его как `DELETE`.

## Команды

```bash
pnpm install
pnpm dev       # http://localhost:3001
pnpm build     # сборка + проверка типов
pnpm deploy    # .output/ — то, что запускается в контейнере
pnpm serve     # запуск .output
pnpm lint      # rs lint
pnpm format    # rs fmt
pnpm check     # rs lint + rs fmt --check
```

## Переменные окружения

Файл `.env.example` — шаблон.

| Переменная             | Время   | Значение                                                                |
| ---------------------- | ------- | ----------------------------------------------------------------------- |
| `PROFILE_ASSET_PREFIX` | сборка  | публичный адрес статики, попадает в `mf-manifest.json` как `publicPath` |
| `BACKEND_BASE_URL`     | рантайм | адрес бэкенда для BFF, по умолчанию `http://backend:8080`               |
| `PORT`                 | рантайм | порт сервера, по умолчанию `3001`                                       |

## Docker

```bash
docker compose up -d --build user-profile
```

Образ собирает `pnpm run deploy` и запускает `node .output/index` на порту 3001. Edge-nginx
публикует его под `user-kit.profile.local` и проксирует `/profile-api/` с обоих доменов —
иначе вызовы из `frontend-main` не попали бы в домен, где живёт host-only cookie.

## Проверка

```bash
pnpm lint
pnpm build
```

Автотестов в проекте нет; контракт с бэкендом проверяется общим `scripts/smoke.ps1`.
