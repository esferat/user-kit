# AGENTS.md — user-profile

Микрофронтенд профиля: Modern.js 3.10 (Rsbuild), React 19.3, antd 6, TanStack Query 5,
react-hook-form 7 + `@hookform/resolvers`, zod 4, BFF (`@modern-js/plugin-bff`),
Module Federation (`@module-federation/modern-js-v3`), FSD. Пакетный менеджер — **pnpm**
(свой `pnpm-workspace.yaml` в каталоге проекта). Домен в стенде: `https://user-kit.profile.local`.

Подключается в `frontend-main` как remote `user_profile`. Exposes: `./ProfilePage` (личный
кабинет), `./ProfileEdit` (форма правки) и `./ProfileAvatar` (аватар в шапке хоста).

## Структура

```
api/lambda/                 BFF-роуты, только сервер
  profile.ts                GET/PATCH профиля
  profile/avatar.ts          POST/DELETE аватара
shared/                     общий слой FSD (Modern.js: общий для api/, server/, src/)
  api/backend.ts            серверный прокси к бэкенду — единственный, кто видит backend
  api/logger.ts             серверный логгер Pino (формат строки — как у бэкенда)
  api/errors.ts             BackendRefusal — отказ бэкенда, показываемый человеку
  config/  lib/  model/  ui/
src/
  routes/                   conventional routing (layout, page, profile/edit)
  entities/user/            запрос профиля, типы, ProfileAvatar, ProfileCard
  features/profile-view/    страница «Личный кабинет»; index.tsx — точка входа MF `./ProfilePage`
  features/profile-edit/    форма; index.tsx — точка входа MF `./ProfileEdit`
  features/profile-avatar/  аватар для шапки хоста; index.tsx — точка входа MF `./ProfileAvatar`
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
- **multipart на сервере приходит не `FormData`.** Hono разбирает тело до хендлера
  (`c.req.parseBody()` → объект с null-prototype), и `fetch` на нём падает с «Cannot convert
  object to primitive value». Роут аватара перекладывает поля в настоящий `FormData`
  (`toFormData` в `api/lambda/profile/avatar.ts`); `req.raw.formData()` не работает — тело уже
  прочитано. Тип параметра хендлера остаётся `FormData` — его же видит клиент.
- **MF-шаринг задан явно** в `module-federation.config.ts`: `react`, `react-dom` и
  `react-dom/client` — singleton. `react-dom/client` — отдельный ключ: точный `react-dom` sub-path
  не покрывает, и remote собрал бы свою копию клиентского рендерера, которая спорит со вшитым в
  Next canary React хоста («Incompatible React versions», module-federation/core#4727). `antd`
  шарится тоже, но хост его в share scope не отдаёт — у него своя копия.
- **Логи — только на сервере**: логгер (`shared/api/logger.ts`) лежит рядом с `backend.ts` и, как он,
  импортируется исключительно из `api/lambda` и слоя `shared/api`. Через `shared/lib/index.ts` его
  выводить нельзя — клиент импортирует тот индекс значениями, и `node:fs` сломал бы клиентскую
  сборку. Строки в формате бэкенда `[LEVEL]-[yyyy-MM-dd HH:mm:ss.SSS]- message` (UTC), уровень —
  `LOG_LEVEL`, файл — `LOG_FILE`; формат разбирает `vector/vector.toml`.
- **Падение роута логируется один раз**: `backend.ts` пишет каждый вызов бэкенда
  (`Backend call` на info, `Backend call failed` на 5xx), а исключение роута — `logFailure` в
  необязательном `onError` `safeAction`/`safeRead`. Отказ бэкенда роут бросает как `BackendRefusal`
  (`shared/api/errors.ts`): `logFailure` пишет такие причины на debug, чтобы анонимные 401 не
  выглядели падениями; транспортные ошибки в `backend.ts` не логируются — их пишет `logFailure`.
  Новую причину добавляй через `BackendRefusal`/`onError`, а не своим `logger.error` в роуте.
- **Exposes рендерятся внутри хоста.** Каждая MF-точка входа (`features/*/index.tsx`) привозит
  свои `AppProviders`: в чужом приложении нет ни своего QueryClient, ни контекста antd. Роутер
  хоста не импортируется — переход задаётся колбэком (`onEdit` у `./ProfilePage`, хост передаёт
  `router.push` из `next/navigation`). Локальные маршруты переиспользуют те же фичи:
  `routes/page.tsx` рендерит `ProfileView` с `onEdit` от `useNavigate` Modern.js.
- **Миниатюра в шапке хоста** — expose `./ProfileAvatar` (`features/profile-avatar`): читает профиль
  через BFF и показывает `avatarThumbnailUrl`. Хост рисует его вместо локального `<Avatar>` и
  держит локальную плашку с инициалами на данных сессии как запасной вариант.
- **QueryClient в браузере — синглтон** (`shared/ui/AppProviders.tsx`, ключ `Symbol.for` в
  `globalThis`): все exposes делят один кеш TanStack Query, поэтому `invalidateQueries` после
  сохранения формы доходит до аватара в шапке и карточки профиля без шины. На сервере клиент
  по-прежнему создаётся на каждый запрос — SSR не делится состоянием.
- **Правка в соседней вкладке** — шина `entities/user/model/profileSync.ts` (BroadcastChannel
  `user-kit:profile`): форма после успеха зовёт `publishProfileUpdated()`, `useProfileQuery`
  подписан на событие и перечитывает профиль. В самой вкладке шина не нужна — там работает
  синглтонный кеш; BroadcastChannel вкладке-отправителю сообщение не доставляет.
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
