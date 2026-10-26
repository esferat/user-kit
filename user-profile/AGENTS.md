# AGENTS.md — user-profile

Микрофронтенд профиля: Modern.js 3.10 (Rsbuild), React 19.3, antd 6, TanStack Query 5,
react-hook-form 7 + `@hookform/resolvers`, zod 4, BFF (`@modern-js/plugin-bff`),
Module Federation (`@module-federation/modern-js-v3`), FSD. Пакетный менеджер — **pnpm**
(свой `pnpm-workspace.yaml` в каталоге проекта). Домен в стенде: `https://user-kit.profile.local`.

Подключается в `frontend-main` как remote `user_profile`, expose — `./ProfileEdit`.

## Структура

```
api/lambda/                 BFF-роуты, только сервер
  profile.ts                GET/PATCH профиля
  profile/avatar.ts          POST/DELETE аватара
shared/                     общий слой FSD (Modern.js: общий для api/, server/, src/)
  api/backend.ts            серверный прокси к бэкенду — единственный, кто видит backend
  config/  lib/  model/  ui/
src/
  routes/                   conventional routing (layout, page, profile/edit)
  entities/user/            запрос профиля, типы, ProfileAvatar, ProfileCard
  features/profile-edit/    форма; index.tsx — точка входа MF
  widgets/profile-shell/    оболочка локального экрана
```

Алиасы (`tsconfig.json`): `@/*` → `src/*`, `@shared/*` → `shared/*`, `@api/*` → `api/lambda/*`,
`@entities/*`, `@features/*`, `@widgets/*`.

## Правила

- **FSD соблюдай вручную**: слой импортирует только слои ниже (`widgets` → `features` →
  `entities` → `shared`). Публичный API слоя — `index.ts`. ESLint границы не проверяет.
- **Браузер не знает про бэкенд.** Весь сетевой код клиента — вызовы `@api/*` (unified
  invocation). `process.env`, `BACKEND_BASE_URL` и cookie живут только в `shared/api/backend.ts`,
  который импортируется исключительно из `api/lambda`.
- **Валидация одна**: `profileDetailsSchema` из `shared/model`. Клиент — `zodResolver`,
  сервер — `safeAction`. Не дублируй правила в компонентах.
- **Имена экспорта в `api/lambda` — это HTTP-методы** (`get`, `post`, `patch`, `del`).
  Слово `delete` использовать нельзя: генератор клиентской части BFF выдаёт
  `export var delete` и сборка падает с ошибкой парсера.
- **Ответ BFF — безопасный результат**, не исключение: `SafeReadResult` (`{data,error}`) или
  `SafeActionResult` (`{data,validationErrors,serverError}`). UI разбирает его сам.
- **Патч профиля** отправляет только `displayName` и `email`: бэкенд отклоняет любые
  read-only поля (`read_only_property`).
- **Аватар принимаем только PNG/JPEG** — бэкенд декодирует через ImageIO, WebP/GIF отвергает.
- Комментарии и JSDoc — на русском.

## Команды

```bash
pnpm install
pnpm dev        # http://localhost:3001
pnpm build      # сборка + проверка типов
pnpm deploy     # .output/ — продакшн-сервер, его копирует Dockerfile
pnpm lint       # rs lint
pnpm format     # rs fmt
pnpm check      # rs lint + rs fmt --check
```

Форматтер — `rs fmt` (Prettier-compatible), конфиг в `rstack.config.mts`. Prettier в проекте нет,
не добавляй его параллельно.

## Docker

```bash
docker compose up -d --build user-profile
```

`PROFILE_ASSET_PREFIX` подставляется на этапе **сборки** (`ARG` в Dockerfile) — после его смены
нужен пересбор образа. `BACKEND_BASE_URL` и `PORT` читаются в рантайме.

## Проверка перед сдачей

```bash
pnpm lint && pnpm build
```

Автотестов в проекте нет; интеграция с бэкендом проверяется общим `scripts/smoke.ps1`.
