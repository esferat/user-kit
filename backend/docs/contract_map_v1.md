# Карта контрактов — backend, v1

**Статус:** действует. Базовая точка — 2026-10-23.
**Роль проекта:** поставщик (provider) HTTP-контракта `/api/v1` и владелец схемы БД.
**Потребители:** `frontend-main`, `scripts/smoke.ps1`,
внешние клиенты через OpenAPI.

Этот документ описывает контракт **по коду**, а не по намерениям. Повествование и примеры —
в [`../../docs/api.md`](../../docs/api.md); здесь — таблицы, из которых можно сверять
совместимость. Публичный базовый URL стенда: `https://user-kit.local` (тот же API отдаёт
`user-kit.next.local`).

## 1. Общие соглашения

| Пункт | Значение |
| --- | --- |
| Префикс API | `/api/v1` |
| Формат | JSON, `Content-Type: application/json; charset=UTF-8`; бинарники — свой тип |
| Аутентификация | браузер — сессионные cookie; CLI — `Authorization: Bearer` |
| CSRF | включён: cookie `XSRF-TOKEN` → заголовок `X-XSRF-TOKEN` на `POST`/`PATCH`/`DELETE`; запросы с `Authorization` освобождены |
| Конкурентность | `ETag: W/"<version>"` + `If-Match` (опционален; без него — last write wins) |
| Коллекции | `PageResult{items,total,page,size}`, параметры `search`, `sort`, `page`, `size` |
| Ошибка | единый JSON `{timestamp,status,code,message,path,violations}` |
| Идентификаторы | UUID; время — ISO-8601 UTC (`Instant`) |
| Документация | `GET /v3/api-docs`, `/swagger-ui/index.html` — публичны |
| Health | `GET /actuator/health` (liveness/readiness probes включены) |

`sort` — имя свойства с необязательным ведущим `-` (по убыванию). Неизвестный ключ →
`400 invalid_sort`. `size` обрезается до `REST_MAX_PAGE_SIZE` (по умолчанию 200), `size < 1` → 1.
`page` не нормализуется в ответе: `page` эхом возвращается как передан.

## 2. Аутентификация и cookie

| Cookie | Содержимое | TTL | Признак |
| --- | --- | --- | --- |
| `UK_SESSION` | id серверной сессии (`auth_session`) | `OIDC_SESSION_TTL` (12h) | `httpOnly`, `SameSite=Lax`, `Secure` по `OIDC_COOKIE_SECURE` |
| `UK_TOKEN` | access token | до истечения токена | `httpOnly` |
| `UK_DEV_TOKEN` | локальный dev-токен | `DEV_AUTH_TTL` (12h) | `httpOnly`, только dev |
| `XSRF-TOKEN` | CSRF-токен | сессия браузера | **читаемая** (`httpOnly=false`), путь `/` |

`UK_SESSION` — единственное, что нужно браузеру: `SessionTokenFilter` находит по нему сессию в
БД, при необходимости обновляет токен, кладёт его в `UK_TOKEN` и сам аутентифицирует запрос.
Веб-фильтр намеренно не читает `UK_SESSION`/`UK_TOKEN` как bearer: иначе cookie, которую браузер
прикрепляет автоматически, давала бы освобождение от CSRF. `Authorization: Bearer` и
`UK_DEV_TOKEN` читает `CookieAwareBearerTokenResolver` — это путь CLI и dev-режима.
Refresh token хранится только в БД (`auth_session.refresh_token`, в таблице лежит хеш id сессии),
в браузер не попадает.

Режим входа отдаёт `GET /api/v1/auth/config`:

```json
{ "mode": "oidc", "devEnabled": true, "oidcConfigured": true, "registrationEnabled": true }
```

`mode`: `oidc` (провайдер), `dev` (локальный вход), `none` (вход выключен). Приоритет — `oidc`,
затем `dev`.

## 3. Эндпоинты

### 3.1 Профиль (`MeController`)

| Метод | Путь | Доступ | Тело/параметры | Успех |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/me` | authenticated | — | `200 ProfileDto` |
| `PATCH` | `/api/v1/me` | authenticated | `displayName`, `email`, `If-Match?` | `200 ProfileDto` |
| `POST` | `/api/v1/me/avatar` | authenticated | `multipart/form-data`, часть `file` | `200 ProfileDto` |
| `DELETE` | `/api/v1/me/avatar` | authenticated | — | `200 ProfileDto` (идемпотентно) |
| `GET` | `/api/v1/me/avatar` | authenticated | — | `200 image/png`, `Cache-Control: private, max-age=3600` |
| `GET` | `/api/v1/me/avatar/thumbnail` | authenticated | — | `200 image/png`, то же |

Правила профиля: `displayName` 1..255; `email` — валидный адрес или `""` (очистка). Первый
успешный `PATCH` ставит `profile_overridden`: после этого IdP больше не перезаписывает имя и
почту из claims.

Аватар: растр до 5 МиБ (`ProfileUseCases.AVATAR_MAX_BYTES`, больше → `413 payload_too_large`), до
25 млн пикселей, центр-кроп в квадрат и перекодирование в PNG: 512×512 и 64×64. SVG/WebP и прочее,
что не декодирует ImageIO, → `400 invalid_image`. Ключи в хранилище:
`avatars/<accountId>/<uuid>/full.png` и `.../thumbnail.png`.

### 3.2 Файлы (`FileController`)

| Метод | Путь | Доступ | Тело/параметры | Успех |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/files` | authenticated | `search`, `sort`, `page`, `size` | `200 PageResult<FileDto>` |
| `GET` | `/api/v1/files/{id}` | владелец или admin | — | `200 FileDto` |
| `POST` | `/api/v1/files` | authenticated | `multipart/form-data`: `file`, `description?` | `201 FileDto` |
| `GET` | `/api/v1/files/{id}/content` | владелец или admin | — | `200` бинарник + `Content-Disposition: attachment` + `ETag` |
| `PATCH` | `/api/v1/files/{id}` | владелец или admin | `name`, `description`, `If-Match?` | `200 FileDto` |
| `DELETE` | `/api/v1/files/{id}` | владелец или admin | `If-Match?` | `204` |

Правила файлов:

- пустая загрузка → `400 empty_file`; больше `FILES_MAX_SIZE_BYTES` (25 МиБ) → `413 payload_too_large`;
- имя сводится к последнему сегменту пути, управляющие символы удаляются, длина ≤ 512;
- ключ объекта генерирует сервер: `files/<yyyy>/<MM>/<uuid>/<name>`;
- SHA-256 содержимого пишется в `file_object.checksum`;
- сбой вставки в БД откатывает загруженный объект;
- чужой файл → `404 not_found` (не `403`);
- admin видит и меняет файлы всех пользователей.

Сортировки: `createdAt` (по умолчанию `-createdAt`), `name`, `sizeBytes`, `updatedAt`,
`ownerEmail` — с `-` и без. Поиск: `name`, `description`, `ownerEmail`, регистронезависимо.

### 3.3 Пользователи (`UserAdminController`, только admin)

| Метод | Путь | Тело/параметры | Успех |
| --- | --- | --- | --- |
| `GET` | `/api/v1/users` | `search`, `sort`, `page`, `size` | `200 PageResult<AccountDto>` |
| `GET` | `/api/v1/users/{id}` | — | `200 AccountDto` |
| `PATCH` | `/api/v1/users/{id}` | `roles`, `enabled`, `If-Match?` | `200 AccountDto` |

Сортировки: `email` (по умолчанию), `displayName`, `username`, `createdAt`, `updatedAt` — с `-`
и без. Поиск: `email`, `displayName`, `username`. Роли: непустое подмножество `admin`/`user`;
`["admin","user"]` хранится как `["admin"]` (`admin` исключающий). Не-admin получает `403`.

### 3.4 Вход (`AuthController`)

| Метод | Путь | Доступ | Ответ |
| --- | --- | --- | --- |
| `GET` | `/api/v1/auth/config` | публично | `200 AuthConfig` |
| `GET` | `/api/v1/auth/login?returnUrl=` | публично | `302` на провайдера (или `400 oidc_disabled`) |
| `GET` | `/api/v1/auth/register?returnUrl=` | публично | `302` на регистрацию (или `400 registration_disabled`/`oidc_disabled`) |
| `GET` | `/api/v1/auth/callback?code&state&error` | публично | `302` в приложение; при ошибке — `302 <app>?authError=1`, cookie очищены |
| `POST` | `/api/v1/auth/dev-login` | публично, только dev | `200 DevSession`, cookie `UK_DEV_TOKEN` |
| `POST` | `/api/v1/auth/logout` | публично | `200 {redirectUrl}`; cookie очищены, серверная сессия закрыта |

`returnUrl` и origin учитываются при выборе callback из `OIDC_CLIENT_REDIRECT_URIS`: вход
всегда возвращается на тот домен, с которого начался.

### 3.5 Dev-хелперы (`DevTokenController`, только `DEV_AUTH_ENABLED=true`)

| Метод | Путь | Ответ |
| --- | --- | --- |
| `GET` | `/api/v1/dev/roles` | `200 ["user","admin"]` |
| `GET` | `/api/v1/dev/token?role=user\|admin&subject=` | `200 DevToken` |

## 4. Модели

### `ProfileDto` — `GET/PATCH /me`, ответы аватара

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | UUID | |
| `subject` | string | `sub` из IdP |
| `username` | string | |
| `email` | string | `""`, если не задан |
| `displayName` | string | |
| `roles` | string[] | отсортированы |
| `enabled` | boolean | |
| `version` | long | версия агрегата |
| `createdAt`, `updatedAt` | Instant | |
| `avatarUrl` | string \| null | `/api/v1/me/avatar?v=<ms>` |
| `avatarThumbnailUrl` | string \| null | `/api/v1/me/avatar/thumbnail?v=<ms>` |
| `avatarUpdatedAt` | Instant \| null | |
| `etag` | string | `W/"<version>"` |

### `AccountDto` — `/api/v1/users`

Поля: `id`, `subject`, `username`, `email`, `displayName`, `roles[]`, `enabled`, `version`,
`createdAt`, `updatedAt`, `etag`. Отличия от `ProfileDto`: нет аватара.

### `FileDto` — `/api/v1/files`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | UUID | |
| `name` | string | ≤ 512, без путей |
| `description` | string \| null | |
| `contentType` | string | из загрузки |
| `sizeBytes` | long | |
| `checksum` | string | SHA-256 hex |
| `ownerId` | UUID | |
| `ownerEmail` | string | |
| `createdAt`, `updatedAt` | Instant | |
| `etag` | string | `W/"<version>"` |

`POST` с пустым `description` не создаёт описание; `PATCH` без поля не меняет его, `PATCH` с
`""` очищает (см. `UpdateFileCommand`).

### `PageResult<T>`

```json
{ "items": [], "total": 0, "page": 0, "size": 50 }
```

`total` — число совпадений до нарезки страницы.

### Auth-модели

| Модель | Поля |
| --- | --- |
| `AuthConfig` | `mode` (`oidc`\|`dev`\|`none`), `devEnabled`, `oidcConfigured`, `registrationEnabled` |
| `DevLoginRequest` | `role` (`user`\|`admin`), `subject?` |
| `DevSession` | `subject`, `displayName`, `email`, `roles[]`, `expiresAt` (epoch seconds) |
| `LogoutResponse` | `redirectUrl` (string \| null) |
| `DevToken` | `accessToken`, `tokenType`, `expiresAt`, `subject`, `email`, `displayName`, `roles[]` |

### Документ ошибки

```json
{
  "timestamp": "2026-10-23T10:00:00Z",
  "status": 412,
  "code": "precondition_failed",
  "message": "The resource was modified by another request",
  "path": "/api/v1/files/6f1c...",
  "violations": [{ "field": "displayName", "message": "..." }]
}
```

401/403 от security-фильтра приходят в компактном виде без `timestamp`/`status`/`path`:
`{ "code": "unauthorized", "message": "...", "violations": [] }`.

## 5. Коды ошибок

| Код | Статус | Когда |
| --- | --- | --- |
| `unauthorized` | 401 | нет/просрочен токен |
| `forbidden` | 403 | роль не подходит |
| `bad_request` | 400 | битый JSON/параметр, неизвестное свойство, отсутствующая часть |
| `validation_failed` | 400 | bean validation, детали в `violations` |
| `invalid_sort` | 400 | неизвестный ключ сортировки |
| `invalid_name` | 400 | имя файла пустое/длинное/из одних разделителей |
| `invalid_roles` | 400 | пустой набор ролей или неизвестная роль |
| `read_only_property` | 400 | PATCH пытается менять неизменяемое поле |
| `invalid_profile` | 400 | `displayName`/`email` не прошли валидацию |
| `invalid_image` | 400 | аватар не растр или слишком большой по пикселям |
| `unreadable_upload` | 400 | multipart-часть не читается |
| `empty_file` | 400 | пустая загрузка |
| `unknown_role` | 400 | dev-токен с ролью вне `user`/`admin` |
| `oidc_disabled` | 400 | `/auth/login` при выключенном OAuth |
| `registration_disabled` | 400 | self-registration выключена |
| `dev_disabled` | 400 | dev-вход выключен |
| `auth_state_invalid` | 400 | `state` неизвестен или истёк |
| `not_found` | 404 | нет ресурса (в т.ч. чужой файл) |
| `conflict` | 409 | конфликтующее состояние |
| `precondition_failed` | 412 | `If-Match` не совпал |
| `payload_too_large` | 413 | превышен лимит загрузки |
| `method_not_supported` | 405 | метод не поддерживается ресурсом |
| `auth_session_unrenewable` | 400 | у сессии нет refresh token (создаётся как `validation`) |
| `identity_provider_error` | 502 | IdP отказал (`upstream`) |
| `storage_unavailable` | 502 | объектное хранилище недоступно (`upstream`) |
| `internal_error` | 500 | непредвиденная ошибка (логируется) |

## 6. Права доступа

| Шаблон | Правило |
| --- | --- |
| `/actuator/health/**`, `/actuator/info` | публично |
| `/v3/api-docs/**`, `/swagger-ui/**`, `/swagger-ui.html` | публично |
| `/api/v1/auth/config`, `/login`, `/register`, `/callback`, `/dev-login`, `/logout` | публично |
| `/api/v1/dev/**` | публично, но контроллер существует только при `DEV_AUTH_ENABLED=true` |
| `/api/v1/admin/**`, `/api/v1/users`, `/api/v1/users/**` | `hasRole("ADMIN")` |
| всё остальное | `authenticated()` |
| владение файлом | проверяется в use case, чужой → 404 |

## 7. Хранение

| Таблица | Назначение | Ключевые колонки |
| --- | --- | --- |
| `user_account` | аккаунт | `id`, `subject` (unique), `username`, `email`, `display_name`, `enabled`, `profile_overridden`, `avatar_key`, `avatar_thumbnail_key`, `avatar_content_type`, `avatar_updated_at`, `version`, `created_at`, `updated_at` |
| `user_account_role` | роли | `user_id`, `role` (PK `user_id+role`, индекс по `role`) |
| `file_object` | файлы | `id`, `owner_id`, `name`, `description`, `storage_key` (unique), `content_type`, `size_bytes`, `checksum`, `version`, `created_at`, `updated_at`; индекс `(owner_id, created_at desc)` |
| `auth_session` | серверные сессии | `id_hash` (PK — хеш cookie, не сам id), `subject`, `client_id`, `access_token_expires_at`, `refresh_token`, `id_token`, `created_at`, `updated_at` |
| `auth_login_state` | начатые входы (PKCE) | `state_hash` (PK), `redirect_uri`, `code_verifier`, `callback_uri`, `created_at`, `expires_at` |

Миграции: `V1__initial_schema`, `V2__oauth_session`, `V3__oauth_login_state_callback`,
`V4__user_avatar`. `ddl-auto: validate` — схема обязана совпадать с маппингом; применённые
миграции не правятся.

Объекты в хранилище: `files/<yyyy>/<MM>/<uuid>/<name>`, `avatars/<accountId>/<uuid>/full.png`,
`.../thumbnail.png`. Бакет приватный, наружу отдаётся только через API.

## 8. Конфигурация (env)

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | — | `dev` включает SQL-логи и демо-данные |
| `SERVER_PORT` / `BACKEND_PORT` | 8080 | порт приложения / хоста |
| `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` | `jdbc:postgresql://localhost:5432/userkit` | БД |
| `OIDC_ENABLED` | `true` | JWT resource server |
| `OIDC_ISSUER_URI`, `OIDC_JWK_SET_URI` | — | issuer и (опционально) отдельный JWKS |
| `OIDC_AUDIENCES`, `OIDC_ROLES_CLAIM` | `user-kit-api`, `roles` | проверка токена |
| `OIDC_CLIENT_ENABLED` | `false` | cookie-логин (на стенде `true`) |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | `user-kit-bff`, — | конфиденциальный клиент |
| `OIDC_CLIENT_ISSUER_URI` | — | discovery по внутреннему адресу |
| `OIDC_CLIENT_REDIRECT_URIS` / `..._POST_LOGOUT_REDIRECT_URIS` | списки доменов | allowlist callback'ов и выходов |
| `OIDC_CLIENT_REDIRECT_URI`, `OIDC_CLIENT_POST_LOGOUT_REDIRECT_URI` | канонический домен | fallback сингулярных списков |
| `OIDC_CLIENT_SCOPES` | `openid profile email` | |
| `OIDC_LOGIN_STATE_TTL`, `OIDC_SESSION_TTL`, `OIDC_REFRESH_WINDOW` | `10m`, `12h`, `90s` | TTL и окно обновления |
| `OIDC_COOKIE_SECURE`, `OIDC_COOKIE_DOMAIN` | `true`, пусто | атрибуты cookie |
| `OIDC_REGISTRATION_ENABLED` | `true` | ссылка регистрации |
| `DEV_AUTH_ENABLED`, `DEV_AUTH_SECRET` | `false`, dev-секрет | локальный вход и `/api/v1/dev/**` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | `http://localhost:9000`, … | хранилище |
| `S3_PATH_STYLE`, `S3_CREATE_BUCKET` | `true`, `true` | совместимость с S3 |
| `FILES_MAX_SIZE_BYTES` | `26214400` | лимит загрузки |
| `REST_MAX_PAGE_SIZE` | `200` | потолок `size` |
| `CORS_ALLOWED_ORIGINS` (и `..._HEADERS`, `..._EXPOSED_HEADERS`, `CORS_MAX_AGE`) | пусто | CORS; пусто = same-origin |
| `DEMO_DATA_ENABLED` | `true` (в compose) | наполнение пустого стора демо-файлами |
| `LOG_FILE` | пусто | файл лога для Logstash |
| `MAX_UPLOAD_SIZE` | `26m` (compose) | `client_max_body_size` edge |

## 9. Порты и адаптеры

| Порт (`domain/`) | Адаптер (`adapters/out/`) |
| --- | --- |
| `AccountRepository` | `persistence/account/JpaAccountRepository` |
| `FileRepository` | `persistence/file/JpaFileRepository` |
| `FileStorage` | `storage/S3FileStorage` |
| `SessionRepository` | `persistence/auth/JpaSessionRepository` |
| `LoginStateRepository` | `persistence/auth/JpaLoginStateRepository` |
| `IdentityProvider` | `identity/OAuthIdentityProvider` или `identity/DisabledIdentityProvider` |

Внутренний контракт `application/` (вход → выход):

| Сценарий | Вход | Выход |
| --- | --- | --- |
| `FileUseCases.listVisibleTo/get/upload/update/delete` | `CallerContext`, команды, `ifMatch` | `FileDto`, `Download(file, content)` |
| `AccountAdminUseCases.findAll/get/update` | `UUID`, `UpdateAccountCommand` | `AccountDto` |
| `ProfileUseCases.profile/update/saveAvatar/removeAvatar/avatarContent` | `CallerContext`, команды, `FileUpload` | `ProfileDto`, `AvatarContent` |
| `AuthenticationUseCases.*` | состояние входа, код, сессия | `LoginResult`, URL, `TokenSet` |
| `CurrentAccountService.resolve/rolesOf` | `Caller` | `CallerContext` |

## 10. Совместимость и расхождения

Правила версии v1:

- добавление поля в ответ — совместимо; удаление/переименование — новая версия (`/api/v2`);
- неизвестное поле в запросе отклоняется, поэтому клиент не может «дописать» лишнее;
- отсутствие поля в `PATCH` и явный `null` одинаково означают «не менять»; очистка — пустая
  строка (`""` для `description` и `email`);
- коды ошибок и их HTTP-статусы стабильны, тексты `message` — нет.

Известные расхождения документации и кода (актуально на 2026-10-23):

| Место | Написано | На самом деле |
| --- | --- | --- |
| `docs/api.md`, `/api/v1/users` | `size` по умолчанию 100 | контроллер: `50` |
| `docs/api.md`, сортировки | перечислены не все ключи | файлы: +`updatedAt`, `ownerEmail`; пользователи: +`username`, `updatedAt` |
| `docs/api.md` | `GET /api/v1/files/{id}` не описан | эндпоинт есть |
| Vite-фронтенды | — | не читают `checksum` у файла и поля аватара у профиля |
| Vite-фронтенды | — | `PATCH /api/v1/users/{id}` уходит без `If-Match` (в `UserDto` нет `etag`) |
| `frontend-main` | — | форма аватара предлагает WebP, бэкенд его отклоняет (`invalid_image`) |

## 11. Журнал версий

| Версия | Дата | Изменения |
| --- | --- | --- |
| v1 | 2026-10-23 | Зафиксирован текущий контракт после перехода на гексагональную архитектуру и раскладки пакетов по зонам. Поведение API не менялось. |
