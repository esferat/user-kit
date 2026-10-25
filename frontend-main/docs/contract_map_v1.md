# Карта контрактов — frontend-main, v1

**Статус:** действует. Базовая точка — 2026-10-23.
**Роль проекта:** одновременно **потребитель** backend-API и **поставщик** браузерных маршрутов;
плюс собственные контракты игр (правила движка + `localStorage`).
**Провайдер API:** [`../../backend`](../../backend) — см.
[`../../backend/docs/contract_map_v1.md`](../../backend/docs/contract_map_v1.md).
**Домен стенда:** `https://user-kit.next.local`.

Проверено на этой базовой точке: `pnpm lint` чисто, `pnpm build` успешно (10 маршрутов + Proxy),
тестов в пакете нет.

## 1. Маршруты приложения

| Путь | Файл | Доступ | Содержимое |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | публичный | лендинг: кнопка «Войти» / «Личный кабинет» |
| `/login` | `app/login/page.tsx` | публичный (исключён из matcher) | `LoginScreen`: режим `oidc`/`dev`/`none`, `?authError=1` |
| `/profile` | `(protected)/profile/page.tsx` | cookie сессии | карточка профиля, кнопка «Редактировать» |
| `/profile/edit` | `(protected)/profile/edit/page.tsx` | cookie сессии | имя, почта, аватар |
| `/admin` | `(protected)/admin/page.tsx` | cookie + `admin` в UI | заглушка; при роли без `admin` — `Result 403` |
| `/games/match3` | `(protected)/games/match3/page.tsx` | cookie сессии | Phaser-игра «Три в ряд» |
| `/games/lines` | `(protected)/games/lines/page.tsx` | cookie сессии | three.js-игра «Цветные линии» |
| `/games/chess` | `(protected)/games/chess/page.tsx` | cookie сессии | заглушка |
| `/games/checkers` | `(protected)/games/checkers/page.tsx` | cookie сессии | заглушка |

Страницы в основном клиентские; серверные обёртки — корневой `layout.tsx`, `/login` (Suspense из-за
`useSearchParams`) и `(protected)/layout.tsx`. Все маршруты пререндерятся как статические (`○`);
данные приходят только из браузерных запросов к API.

### Защита маршрутов (`src/proxy.ts`)

| Пункт | Значение |
| --- | --- |
| Тип | Next 16 `proxy` (бывший middleware), экспортируется как `proxy` + `config.matcher` |
| Публичные пути | `/` (`PUBLIC_ROUTES`) и `/login` (исключён матчером) |
| Признак сессии | наличие cookie `UK_SESSION` **или** `UK_DEV_TOKEN` |
| Реакция | нет cookie → `307` на `/login` (query сбрасывается) |
| Matcher | `/((?!api|login|_next/static|_next/image|favicon.ico|.*\..*).*)` |
| Границы | это UX-редирект, а не авторизация: валидность cookie проверяет бэкенд |

Второй рубеж — `ProtectedAppShell`: если `useAuth()` перешёл в `anonymous` (cookie была, но сессия
истекла), выполняется `router.replace('/login')`.

## 2. Потребляемые эндпоинты

| Метод | Путь | Где | Тело | Читаемые поля |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/auth/config` | `CookieAuthProvider.config()` (кэш на вкладку) | — | `mode`, `devEnabled`, `oidcConfigured`, `registrationEnabled` |
| `GET` | `/api/v1/me` | `restore()`, `refresh()` | — | `subject`, `displayName`, `email`, `roles`, `username?`, `avatarUrl?`, `avatarThumbnailUrl?` |
| `PATCH` | `/api/v1/me` | `ProfileApi.update` | `{ displayName, email }` | весь `MeResponse` |
| `POST` | `/api/v1/me/avatar` | `ProfileApi.uploadAvatar` | `multipart`, часть `file` | весь `MeResponse` |
| `DELETE` | `/api/v1/me/avatar` | `ProfileApi.removeAvatar` | — | весь `MeResponse` |
| `GET` | `/api/v1/me/avatar` | `<Avatar src>` (браузер) | — | PNG-байты |
| `GET` | `/api/v1/me/avatar/thumbnail` | `<Avatar src>` в меню | — | PNG-байты |
| `GET` | `/api/v1/auth/login` | `login()` при `mode=oidc` | — | `302` + `Set-Cookie` (навигация, не fetch) |
| `POST` | `/api/v1/auth/dev-login` | `login()` при `mode=dev` | `{ role }` | `subject`, `displayName`, `email`, `roles`, `expiresAt` |
| `POST` | `/api/v1/auth/logout` | `logout()` | `{}` | `redirectUrl` |

`GET /api/v1/auth/register` в Next-приложении **не используется** (нет ссылки регистрации).
`/api/v1/files/**`, `/api/v1/users/**`, `/api/v1/dev/**` из этого приложения не вызываются:
раздел `/admin` — заглушка, документов в Next нет.

Аватары встраиваются как `<img src>`: путь, пришедший с бэкенда, склеивается с `apiBaseUrl`
(`joinUrl`), поэтому абсолютный URL работает и при другом origin API.

## 3. Модели

### `MeResponse` (`entities/user/model/types.ts`) — «тело шире, читаем часть»

```ts
interface MeResponse {
  subject: string; displayName: string; email: string; roles: Role[];
  id?: string; enabled?: boolean; username?: string; version?: number; etag?: string;
  avatarUrl?: string | null; avatarThumbnailUrl?: string | null; avatarUpdatedAt?: string | null;
}
```

### `AuthenticatedUser` — модель сессии в браузере

`subject`, `username` (`MeResponse.username ?? email`), `displayName`, `email?`, `roles`,
`avatarUrl?`, `avatarThumbnailUrl?`. Аватарные пути здесь уже абсолютные.

### `AuthConfig`

```ts
type AuthMode = 'oidc' | 'dev' | 'none';
interface AuthConfig { mode: AuthMode; devEnabled: boolean; oidcConfigured: boolean; registrationEnabled: boolean }
```

### Профиль

```ts
interface ProfileDetails { displayName: string; email: string }
interface ProfileApi {
  update(details: ProfileDetails): Promise<MeResponse>;
  uploadAvatar(file: File): Promise<MeResponse>;
  removeAvatar(): Promise<MeResponse>;
}
```

`PATCH` отправляет оба поля всегда, поэтому очистка почты — `email: ""` (бэкенд трактует пустую
строку как «удалить»). `null`/отсутствие поля бэкенд трактует как «не менять».

### `ApiError` (`shared/api/http.ts`)

```ts
class ApiError extends Error { status: number; code: string; body: ApiErrorBody | null; get isUnauthorized(): boolean }
interface ApiErrorBody { code?: string; message?: string; target?: string; details?: unknown }
```

`code = body.code ?? http_<status>`; `isUnauthorized` — `401` **и** `403`. Поля документа ошибки
`timestamp`, `status`, `path`, `violations` не читаются; UI показывает `message`.

## 4. Аутентификация и cookie

| Cookie | Кто ставит | Кто читает | Назначение |
| --- | --- | --- | --- |
| `UK_SESSION` | бэкенд | `proxy.ts` (только наличие), браузер | серверная сессия OIDC |
| `UK_DEV_TOKEN` | бэкенд | `proxy.ts` (только наличие), браузер | локальный dev-вход |
| `UK_TOKEN` | бэкенд | никто в JS | access token для сессии |
| `XSRF-TOKEN` | бэкенд | `shared/api/http.ts` | CSRF-заголовок |

- `fetch` всегда с `credentials: 'include'`; `Authorization` не ставится.
- `X-XSRF-TOKEN` добавляется на `POST`/`PATCH`/`DELETE`, если cookie читается.
- `GET /api/v1/auth/config` кэшируется в провайдере; неудача кэш не заполняет.
- Статусы сессии: `restoring` → `anonymous` | `authenticated` | `error`.
  `401` при восстановлении — штатный `anonymous`; остальные ошибки — `error` + `Alert`.
- `logout()` сначала локально чистит пользователя, затем `POST /auth/logout`; если бэкенд вернул
  `redirectUrl`, браузер уходит на него (завершение сессии IdP).
- После сохранения профиля `auth.refresh()` перечитывает `/me`, чтобы шапка показала новое имя и
  аватар без перезагрузки.

## 5. Контракт игры «Цветные линии» (v1)

### Правила (движок, `features/lines/game/engine.ts`)

| Пункт | Значение |
| --- | --- |
| Поле | 10×10 (`GRID_SIZE = 10`), клетка — индекс `0..99`, `EMPTY = -1` |
| Старт | `ballsPerTurn` случайных шаров + первый предпросмотр |
| Линия | `LINE_LENGTH = 5` и больше, по горизонтали, вертикали и **обеим диагоналям** |
| Списание | все линии через клетку прихода; пересекающиеся линии списываются вместе |
| Очки | `balls*10 + max(0, balls-5)*10 + (lines-1)*50` |
| Ход | шар идёт ортогонально только через свободные клетки; маленькие шары предсказания путь **не** блокируют |
| Бонус | если ход списал шары — новые не падают, предсказание сохраняется, игрок ходит ещё |
| Иначе | спавн предсказания (занятая клетка → случайная свободная), каскадные списания, новый предсказанный бросок |
| Конец | шары есть, но ни один не может сдвинуться (`canMoveAny === false`) → `status: 'over'` |

Уровни (`LINES_LEVELS`):

| Ключ | Название | Шаров за ход | Цветов |
| --- | --- | --- | --- |
| `easy` | Лёгкая | 3 | 3 |
| `medium` (default) | Средняя | 4 | 4 |
| `hard` | Сложная | 4 | 5 |
| `insane` | Очень сложная | 5 | 5 |

### Публичный API движка

```ts
createGame(difficulty: LinesDifficulty, seed = Date.now()): LinesState
findPath(state: LinesState, from: number, to: number): number[] | null  // путь включает from и to
applyMove(state: LinesState, from: number, to: number): MoveOutcome
findHint(state: LinesState): LinesHint | null                          // null — партия окончена
linesThrough(board: number[], size: number, cell: number): number[][]
canMoveAny(board: number[], size: number): boolean
```

```ts
interface LinesState {
  size: number; difficulty: LinesDifficulty; board: number[]; score: number;
  nextColors: number[]; nextCells: number[];
  status: 'playing' | 'over'; seed: number;
}
interface MoveOutcome {
  state: LinesState; cleared: number[]; spawned: number[];
  gained: number; bonus: boolean;
}
interface LinesHint { from: number; to: number; path: number[]; clears: number; line: number }
```

- Партия детерминирована `seed`; `applyMove` продвигает seed (`+0x9e3779b9`).
- `findHint` приоритеты: ход со списанием → ход «свободным» шаром, продолжающий линию → любой ход;
  при равенстве короче путь. Шар, уже стоящий в линии, не предлагается для её же разрушения.
- `findPath` — BFS по четырём направлениям; путь `[from, …, to]`.

### `localStorage`

| Ключ | Схема | Правила чтения |
| --- | --- | --- |
| `lines:settings` | `{ difficulty: LinesDifficulty; musicVolume: number; sfxVolume: number }` | мусор/неизвестная сложность → `null` → дефолты; громкости вне `0..1` → дефолт |
| `lines:stats` | `AttemptEntry[]`, `AttemptEntry = { score: number; difficulty: LinesDifficulty; at: number }` | не-массив/битые записи отбрасываются, сортировка и обрезка при чтении |

- Дефолты настроек: `medium`, `musicVolume 0.45`, `sfxVolume 0.7`.
- `MAX_ATTEMPTS = 5`; порядок: больше очков, при равенстве — раньше сыгранный; слабая попытка может
  не попасть в таблицу.
- Таблица стартует пустой: записи появляются только после проигранной партии.
- Ошибки доступа к хранилищу (приватный режим) проглатываются — игра работает без него.

### Звук (`ui/sound.ts`)

`SoundEngine(musicVolume, sfxVolume)` — Web Audio без ассетов; методы `resume`, `setMusicVolume`,
`setSfxVolume`, `playJump`, `playStep(strong)`, `playClear`, `startMusic`, `stopMusic`, `dispose`.
Музыка стартует после первого `pointerdown`/`keydown` (политика автозапуска браузера), контекст
освобождается при уходе со страницы.

### Рендер (`game/board.ts`)

`LinesBoard(container, onCellClick)`; `sync`, `animateMove(path, onStep)`, `animateClear`,
`animateSpawn`, `dispose`. Основной маршрут — жёлтые «отпечатки» (`0xffd43b`/`0xffe066`), подсказка —
белая; материалы с `toneMapped: false`, чтобы цвета не выцветали.

## 6. Контракт игры «Три в ряд» (v1)

| Пункт | Значение |
| --- | --- |
| Поле | 10×10 (`GRID_SIZE`), клетка 80 px |
| Цвета | палитра из 6; уровни берут первые 4/5/6 |
| Уровни | «Лёгкий» 4, «Средний» 5, «Сложный» 6 (`DIFFICULTIES`, default — лёгкий) |
| Совпадение | 3+ одинаковых по горизонтали или вертикали |
| Радужный | линия 5+ |
| Молния | ровно 4: горизонталь чистит строку, вертикаль — столбец |
| Бомба | пересечение горизонтали и вертикали по 5+ (когда спецэлементы ещё не созданы) |
| Цепочки | активации спецэлементов цепные; радиус бомбы — по евклидову расстоянию |
| Состояние | только в памяти: счёт и уровень не сохраняются, таблица лидеров — мок |

Публичные модули: `features/match3` → `Match3Game`; модель (`model/*`) — чистые классы клеток
(`ball`, `bomb`, `lightning`, `rainbow`), правила (`game/rules.ts`) — чистые функции над сеткой.
`Match3Scene` предоставляет `setScore`, `setDifficulty(colors)`, `resetGame`.

## 7. Локальные контракты модулей

| Модуль | Экспорт |
| --- | --- |
| `@/features/auth` | `AuthProvider`, `AuthConfig`, `AuthMode`, `LoginOptions`, `AuthenticationError`, `SessionStore`, `AuthStatus`, `useAuth`, `useCurrentUser`, `createAuthProvider`, `AuthSessionProvider`, `LoginScreen`, `ProfileMenu` |
| `@/features/profile-edit` | `ProfileEditForm`, `ProfileApi`, `ProfileDetails`, `createProfileApi` |
| `@/features/lines` | `LinesGame` (default и named) |
| `@/features/match3` | `Match3Game` (default и named) |
| `@/entities/user` | `AuthenticatedUser`, `MeResponse`, `Role`, `ROLES`, `DEFAULT_ROLE`, `hasRole`, `hasAdmin`, `collectRoles`, `extractRoles`, `normalizeRole`, `readClaimPath`, `ProfileCard` |
| `@/widgets/app-shell` | `AppShell`, `NAV_ENTRIES`, `NavEntry`, `NavGroup`, `NavLink`, `isNavGroup`, `visibleNavEntries`, `openGroupKeys` |
| `@/shared/api` | `request`, `requestJson`, `joinUrl`, `ApiError`, `ApiErrorBody`, `csrfHeaders`, `readCookie` |
| `@/shared/config` | `appConfig`, `AppConfig`, `normalizeBaseUrl` |

Навигация (`NAV_ENTRIES`): группа «Игры» → `/games/{chess,checkers,match3,lines}`, пункт
«Администрирование» → `/admin` (роль `admin`). Пункта «Документы» в Next нет.

## 8. Конфигурация и сборка

| Переменная | Где | Значение |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | build-time (`ARG` в `Dockerfile`, читается `shared/config/config.ts`) | пусто = same-origin; в compose берётся из `VITE_API_BASE_URL` |
| `NODE_ENV` | runtime (compose) | `production` |
| `PORT`, `HOSTNAME` | runtime | `3000`, `0.0.0.0` |
| `NODE_VERSION` образа | `Dockerfile` | `node:22-alpine`, standalone, пользователь `nextjs` (uid 1001) |

- `NEXT_PUBLIC_*` инлайнится компилятором: изменение требует пересборки образа.
- Своего прокси у Next нет; `/api` на стенде заворачивает nginx, локально нужен
  `NEXT_PUBLIC_API_BASE_URL` + CORS на бэкенде.
- Dev: `pnpm dev` → `http://localhost:3000`. Прод: `node server.js` из `.next/standalone`.

## 9. Расхождения и ограничения

| Что | Следствие |
| --- | --- |
| `/admin` — заглушка | `/api/v1/users` не вызывается, управление пользователями доступно только в Vite-SPA |
| В Next нет документов | `/api/v1/files/**` не используется вовсе |
| `MeResponse` читает подмножество | `version`, `etag`, `id`, `enabled` не используются |
| `PATCH /api/v1/me` без `If-Match` | конкурентная правка профиля не даёт 412 (осознанно: профиль правит только владелец) |
| WebP в `accept` аватара | бэкенд декодирует ImageIO и отвечает `400 invalid_image` |
| Игровая статистика только локальная | `lines:stats` не синхронизируется между устройствами |
| `board-old.ts` | мёртвый файл «Цветных линий», не импортируется |
| Тестов нет | `pnpm lint` + `pnpm build` — единственные автоматические гейты |
| Next 16.4.0 | `next build` печатает предупреждение об известной уязвимости и предлагает обновление |

## 10. Журнал версий

| Версия | Дата | Изменения |
| --- | --- | --- |
| v1 | 2026-10-23 | Зафиксированы маршруты, потребляемые эндпоинты, cookie/CSRF, контракты движков match-3 и «Цветных линий», схемы `lines:settings`/`lines:stats`. `pnpm lint` и `pnpm build` зелёные. |
