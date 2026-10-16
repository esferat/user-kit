# Нефункциональные и security-требования

## Хранение секретов/токенов

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-01 | Токены **не хранятся** в `localStorage`, `sessionStorage`, IndexedDB, DOM. Единственное хранилище в браузере — `HttpOnly` cookies. | `docs/auth.md:42-50`, `AuthCookies` |
| NF-AUTH-02 | `UK_SESSION`, `UK_TOKEN`, `UK_DEV_TOKEN` — `HttpOnly=true`. | `AuthCookies.base()` |
| NF-AUTH-03 | `refresh_token` хранится **только** на стороне бэкенда (в хранилище сессий), никогда не передаётся браузеру. | `AuthSessionService.refresh`, `docs/auth.md:46-50` |
| NF-AUTH-04 | `client_secret` используется только бэкендом при обмене кода/refresh/revoke. Никогда не попадает во фронтенд-бандл. | BFF-модель (`docs/auth.md:42-50`), `OAuthTokenClient` (по коду) |
| NF-AUTH-05 | `state`, `code_verifier` хранятся в хранилище состояния логина с ограниченным TTL; одноразово удаляются при использовании. | `AuthSessionService.start/complete` |

## CSRF

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-06 | Для всех не-GET запросов при cookie-based аутентификации требуется валидный `X-XSRF-TOKEN`, соответствующий `XSRF-TOKEN` (не HttpOnly). | `SecurityConfig:95-109`, `docs/auth.md:69-87` |
| NF-AUTH-07 | CSRF-проверка **игнорируется**, если запрос содержит `Authorization: Bearer ...`. | `SecurityConfig:97-100` |
| NF-AUTH-08 | CSRF-репозиторий — `CookieCsrfTokenRepository.withHttpOnlyFalse()`, cookie настраивается с `Path=/`, `SameSite=Lax`, `Secure` по флагу. | `SecurityConfig.csrfTokenRepository()` |

## Cookie-атрибуты

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-09 | `SameSite=Lax` для всех auth-кок (`UK_SESSION`, `UK_TOKEN`, `UK_DEV_TOKEN`, `XSRF-TOKEN`). | `AuthCookies.base()`, `csrfTokenRepository()` |
| NF-AUTH-10 | `Secure=true` только когда `oauth.cookieSecure=true`. В локальном dev-окружении может быть `false`. | `AuthCookies.base()`, `docker-compose.yml` (комментарий) |
| NF-AUTH-11 | `Path=/` для всех auth-кок. | `AuthCookies.base()` |
| NF-AUTH-12 | `Domain` опциональный; если пуст — host-only. | `AuthCookies.base()` |

## TTL, окна

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-13 | `loginStateTtl` — срок жизни состояния логина (по умолчанию 10m). | `AppProperties.OAuth.loginStateTtl` (дефолт), `AuthSessionService.start` |
| NF-AUTH-14 | `sessionTtl` — срок жизни серверной сессии (дефолт 12h); старые сессии удаляются при логине/по логике. | `AppProperties.OAuth.sessionTtl`, `completeLogin:152-163` |
| NF-AUTH-15 | `refreshWindow` (дефолт 90s) — окно перед истечением access-токена, при котором выполняется автоматический refresh. | `AppProperties.OAuth.refreshWindow`, `SessionTokenFilter.accessToken:140-164` |
| NF-AUTH-16 | `UK_TOKEN` max-age устанавливается равным оставшемуся lifetime access-токена; при отрицательном — минимум 1 минута. | `AuthCookies.writeAccessToken:48-56` |
| NF-AUTH-17 | `UK_SESSION` max-age = `sessionTtl`. | `writeSession:44-46` |
| NF-AUTH-18 | `UK_DEV_TOKEN` TTL = `DEV_AUTH_TOKEN_TTL`. | `writeDevToken:58-62` |

## PKCE/state, open redirect защита

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-19 | PKCE обязателен: `code_challenge` = S256(`code_verifier`), `code_verifier` хранится только в хранилище состояния логина, используется только при обмене кода. | `AuthSessionService.start` (формирует challenge), `completeLogin` (передаёт verifier) |
| NF-AUTH-20 | `state` генерируется случайным, хранится в виде хеша в хранилище состояния логина, проверяется при callback, одноразово удаляется. | `start:84-104`, `completeLogin:135-165` |
| NF-AUTH-21 | `returnUrl` принимается только как локальный фрагмент `#...`. Любое иное значение (с доменом, множественные `#`, пустое) → замена на дефолтный `appUri`. | `appUri:116-133` |
| NF-AUTH-22 | Callback редирект всегда ведёт на `appUri` соответствующего `origin` (из allowlist/fallback), с добавлением `authError=1` только при ошибках. | `callback`, `errorUrl`, `defaultAppUri` |

## Origin/proxy, домены

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-23 | `origin` вычисляется из прокси-заголовков: берётся **первый** элемент при запятой в `X-Forwarded-Host`/`X-Forwarded-Proto`. | `RequestOrigin.of:15-48` |
| NF-AUTH-24 | Значение `origin` используется **только** для выбора из allowlist (`redirectUriList`, `postLogoutRedirectUriList`). Никогда не используется как есть для редиректа вне allowlist. | `AppProperties.OAuth.matchOrigin/callbackUriFor/appUriFor` |
| NF-AUTH-25 | При отсутствии совпадения с allowlist используется **первый** конфигурированный элемент (fallback). **Требует подтверждения** по безопасности (OQ-AUTH-03). | `matchOrigin:236-260` |
| NF-AUTH-26 | Множественные домены: куки host-only, сессия одного домена невидима другому. Login стартует с того домена, откуда пришёл запрос. | `docs/auth.md:131-148`, nginx-конфиг |

## JWT/claims, роли

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-27 | Валидация JWT: `iss` проверяется (по `issuerUri`), `exp`/`nbf` валидны, `aud` содержит одно из `OIDC_AUDIENCES`. | `docs/auth.md:98-107`, `OidcJwtAuthenticationConverter`/ресурс-сервер |
| NF-AUTH-28 | Роли извлекаются по фиксированному порядку: `rolesClaim` (если задан) → `roles` → `groups` → `realm_access.roles` → `resource_access.<audience>.roles` (по списку аудиторий). | `docs/auth.md:64-95`, `security/RoleClaims`, фронт-референс |
| NF-AUTH-29 | Неизвестные роли игнорируются; trim/lowercase. | `RoleClaims`/нормализация |
| NF-AUTH-30 | Если есть `admin` — результирующий набор = `["admin"]` (исключение `user`). | FR-AUTH-005 |
| NF-AUTH-31 | Если ни одна роль не распознана — назначается `user`. | FR-AUTH-006 |

## Серверный контроль доступа

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-32 | Авторизация **всегда** серверная. UI-скрытие — только UX. | `docs/auth.md:35-38` |
| NF-AUTH-33 | Защищённые ресурсы проверяются `@PreAuthorize`/SecurityConfig: `ADMIN` только для `/api/v1/admin/**`, `/api/v1/users`, `/api/v1/users/**`. Остальные защищённые — `authenticated()`. | `SecurityConfig:110-130` |
| NF-AUTH-34 | Роли — ровно `admin`, `user`. `admin` подразумевает расширенный доступ. | `docs/auth.md:3-15` |

## Надёжность/устойчивость

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-35 | При провале refresh (исключение от IdP) сессия закрывается: `closeSession` удаляет из БД, отзывает refresh-токен (подавление ошибок), куки очищаются. Запрос идёт анонимным. | `SessionTokenFilter:155-164`, `AuthSessionService.closeSession:211-224` |
| NF-AUTH-36 | При ошибках в callback (в т.ч. RuntimeException от провайдера) куки очищаются, редирект `?authError=1`, без утечки стека в ответ браузеру. | `AuthController.callback:124-134` |
| NF-AUTH-37 | Сессии старше `sessionTtl` удаляются при логине и по политике хранения сессий. | `completeLogin:152-163` |
| NF-AUTH-38 | Состояние логина с истёкшим `expiresAt` не используется (`usable(now)=false`). | `completeLogin:138-147` |
| NF-AUTH-39 | `UK_TOKEN` при отрицательном expiresAt получает min 1 минуту жизни в cookie (защита от немедленного удаления). | `writeAccessToken:51-56` |
| NF-AUTH-40 | Исключения при отзыве refresh-токена логируются как `warn` и не прерывают logout-поток. | `closeSession:219-224`, `logout`-поток |

## Конфигурационная безопасность

| Требование | Проверяемое условие | Источник |
|---|---|---|
| NF-AUTH-41 | `redirectUris`/`postLogoutRedirectUris` (plural) и singular fallback формируют **allowlist**. Сопоставление только по origin. | `AppProperties.OAuth:210-290` |
| NF-AUTH-42 | `CookieSecure` должен быть `true` в production (защита передачи кук по HTTP). | `docker-compose.yml` комментарий, `AppProperties` |
| NF-AUTH-43 | `DEV_AUTH_ENABLED` влияет только на dev-профиль/функционал; в production должен быть `false`. | `AuthController.devLogin`, `properties` |
| NF-AUTH-44 | CORS: при пустом `allowedOrigins` API доступен только same-origin (nginx-сценарий). | `SecurityConfig.corsConfigurationSource()` комментарий |

## Наблюдения/открытые аспекты

- **OQ-AUTH-01:** Гонка при refresh в `refreshWindow` — требуется подтверждение идемпотентности/блокировки.
- **OQ-AUTH-03:** Fallback на первый элемент allowlist при несоответствии origin — потенциальный вектор при ошибочной прокси-конфигурации; зафиксировано как наблюдаемое поведение.
- **OQ-AUTH-08:** Граница CSRF-исключения (только по `Authorization` header) применительно к dev-cookie-аутентификации — требует явного подтверждения.