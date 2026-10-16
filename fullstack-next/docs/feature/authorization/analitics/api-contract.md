# API-контракт Authorization (только то, что реально используется фронтендом)

Основано на коде `AuthController`, `SecurityConfig`, `AuthCookies`, `docs/auth.md`.

## Общие правила

- Бэкенд отдаёт только `HttpOnly` cookies браузеру.
- CSRF: для не-GET требуется `X-XSRF-TOKEN` (значение из `XSRF-TOKEN` cookie). Исключение — запросы с `Authorization: Bearer ...`.
- `SameSite=Lax`. `Secure` зависит от `oauth.cookieSecure`.
- `returnUrl` — только локальный фрагмент `#...`, иначе игнорируется.
- Ошибки валидации/бизнес-ошибки auth-потока при callback приводят к редиректу `?authError=1`.

## 1. GET `/api/v1/auth/config`

- **Назначение:** Сообщить фронту доступные методы входа.
- **Метод:** GET
- **Публичный:** да
- **Запрос:** нет параметров
- **Ответ 200 (application/json):**
```json
{
  "mode": "oidc|dev|none",
  "devEnabled": true|false,
  "oidcConfigured": true|false,
  "registrationEnabled": true|false
}
```
- **Источник:** `AuthController.config()` (53-63), record `AuthConfig` (146-147)

## 2. GET `/api/v1/auth/login`

- **Назначение:** Старт OIDC Authorization Code + PKCE.
- **Метод:** GET
- **Публичный:** да
- **Параметры query:**
  - `returnUrl` (optional, string) — ожидается локальный фрагмент `#...`; иначе заменяется на дефолтный `appUri`.
- **Поведение:**
  - Если `!sessions.oauthEnabled()` → 400 `{code:"oidc_disabled", ...}`
  - Определяет `origin` из заголовков прокси → выбирает `callbackUri`, `appUri`.
  - Сохраняет state + code_verifier в хранилище состояния логина.
  - 302 на authorization URL провайдера.
- **Ответы:** 302 (Location), 400 (`oidc_disabled`)
- **Источник:** `login()` (65-76), `AuthSessionService.startLogin` (70-114)

## 3. GET `/api/v1/auth/register`

- **Назначение:** Старт провайдерской регистрации.
- **Метод:** GET
- **Публичный:** да
- **Параметры:** `returnUrl` (optional)
- **Поведение:**
  - `oauthEnabled()`? иначе 400 `oidc_disabled`
  - `oauth.registrationEnabled()`? иначе 400 `registration_disabled`
  - То же сохранение state/PKCE в хранилище состояния логина; редирект на registration URL провайдера; callback общий.
- **Ответы:** 302, 400
- **Источник:** `register()` (78-92)

## 4. GET `/api/v1/auth/callback`

- **Назначение:** Завершение OIDC-потока.
- **Метод:** GET
- **Публичный:** да (вызывается браузером с IdP)
- **Параметры query:**
  - `code` (optional)
  - `state` (optional)
  - `error` (optional) — напр. `access_denied`
- **Поведение:**
  - Если `error!=null` или `code/state` пустые/отсутствуют → 302 `appUri?authError=1`
  - Валидирует state по хешу, удаляет state; обменивает код бэкендом; создаёт сессию.
  - При успехе → 302 `appUri` + `Set-Cookie: UK_SESSION=...; HttpOnly; Path=/; SameSite=Lax; Secure=?`, `Set-Cookie: UK_TOKEN=...; HttpOnly; Path=/; SameSite=Lax; Secure=?`
  - При ошибке (ApiException/RuntimeException/невалидный state) → 302 `appUri?authError=1` + очистка кук
- **Куки:** `UK_SESSION`, `UK_TOKEN`
- **Источник:** `callback()` (107-134), `AuthCookies`

## 5. POST `/api/v1/auth/dev-login`

- **Назначение:** Dev-вход с локальной выдачей токена.
- **Метод:** POST
- **Публичный:** да (с CSRF)
- **Content-Type:** `application/json`
- **Тело (optional):**
```json
{ "role": "user|admin", "subject": "string|null" }
```
- Если тело отсутствует → используется `{role:"user", subject:null}`
- **Поведение:**
  - Если `DevTokenController` недоступен → 400 `dev_disabled`
  - Генерирует dev-токен, выставляет `UK_DEV_TOKEN` cookie.
- **Ответ 200 (application/json):**
```json
{
  "subject": "string",
  "displayName": "string",
  "email": "string",
  "roles": ["user"|"admin"],
  "expiresAt": 1234567890
}
```
- **Set-Cookie:** `UK_DEV_TOKEN=...; HttpOnly; Path=/; SameSite=Lax; Secure=?` (TTL по `DEV_AUTH_TOKEN_TTL`)
- **Источник:** `devLogin()` (94-106), `AuthController.DevSession` (152-154)

## 6. POST `/api/v1/auth/logout`

- **Назначение:** Завершить сессию локально и у IdP.
- **Метод:** POST
- **Публичный:** да (с CSRF)
- **Тело:** может быть пустым/произвольным (метод читает куки)
- **Поведение:**
  - Читает `UK_SESSION`, находит сессию в хранилище сессий (если есть)
  - Очищает `UK_SESSION`, `UK_TOKEN`, `UK_DEV_TOKEN`
  - Удаляет сессию из хранилища сессий, отзывает refresh-токен у IdP (ошибки игнорируются)
  - Формирует `endSessionUrl` (при наличии провайдера)
- **Ответ 200 (application/json):**
```json
{ "redirectUrl": "string|null" }
```
- `redirectUrl` может быть `null` в dev-режиме (нет провайдера).
- **Источник:** `logout()` (136-145), `LogoutResponse` (156-157)

## 7. GET `/api/v1/me`

- **Назначение:** Профиль текущего аутентифицированного пользователя.
- **Метод:** GET
- **Защищённый:** требуется аутентификация
- **Аноним:** 401
- **Ответ 200 (application/json):**
```json
{
  "subject": "string",
  "displayName": "string",
  "email": "string",
  "roles": ["user","admin"]
}
```
- **Источник:** `docs/auth.md:56-57`, матрица доступа

## Куки

| Имя | HttpOnly | SameSite | Secure | Path | Domain | Примечание |
|---|---|---|---|---|---|---|
| `UK_SESSION` | true | Lax | по `oauth.cookieSecure` | / | опц. из конфига | хранит значение sessionId (хеш сессии хранится в логическом хранилище сессий) |
| `UK_TOKEN` | true | Lax | по `oauth.cookieSecure` | / | опц. из конфига | access-токен; обновляется при refresh через Set-Cookie |
| `UK_DEV_TOKEN` | true | Lax | по `oauth.cookieSecure` | / | опц. из конфига | только dev-режим |

## CSRF

- Cookie: `XSRF-TOKEN` (не HttpOnly), SameSite=Lax, Secure по флагу (настраивается через `CookieCsrfTokenRepository`).
- Header: `X-XSRF-TOKEN` для не-GET (POST/PATCH/DELETE).
- Исключение: если есть `Authorization: Bearer ...` — CSRF не проверяется.
- Dev-поток использует cookie-based аутентификацию через dev-токен? Но CSRF-исключение срабатывает только по наличию `Authorization` header; в случае cookie-based dev-аутентификации CSRF должен применяться к не-GET (согласно общей логике). Конкретика dev-контекста требует подтверждения (OQ-AUTH-08), но в текущей реализации SecurityConfig исключает только по `Authorization` header.

## Заголовки прокси (для определения origin)

Используются `RequestOrigin.of()`:
- `X-Forwarded-Proto` (первый элемент при запятой)
- `X-Forwarded-Host` (первый элемент при запятой)
- fallback: `request.getScheme()`, `Host`, `serverName:serverPort`

Значение приводится к `scheme://host[:port]` в нижнем регистре и используется **только** для сопоставления с allowlist (`redirectUriList`, `postLogoutRedirectUriList`).

## Примечания

- Обмен кода выполняется **только бэкендом** (BFF). Браузер никогда не видит `client_secret`, `refresh_token`.
- `state` одноразовый.
- `returnUrl` валидируется как локальный фрагмент.