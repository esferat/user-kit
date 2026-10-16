# Функциональные требования Authorization

Каждое требование имеет ID `FR-AUTH-xxx`, приоритет и ссылку на источник. Формулировка в виде «Система должна...».

## Группа 1. Конфигурация и режимы

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-001 | Система должна определять режим авторизации как `oidc`, `dev` или `none` на основе доступности OAuth-клиента и dev-конфигурации. | Must | `backend/src/main/java/com/acme/usermark/auth/AuthController.java:53-63` (`config()`), `AuthSessionService.oauthEnabled()` |
| FR-AUTH-002 | В `/api/v1/auth/config` система должна возвращать `mode`, `devEnabled`, `oidcConfigured`, `registrationEnabled`. | Must | `AuthController.java:146` (record), `53-63` |
| FR-AUTH-003 | `registrationEnabled` в конфиге должен быть `true` только если `oidc` доступен И `oauth.registrationEnabled` включён. | Must | `AuthController.java:62` |
| FR-AUTH-004 | Система должна использовать только два server-side роли: `admin`, `user`. | Must | `docs/auth.md:3-15` |
| FR-AUTH-005 | Нормализация ролей: при наличии `admin` результирующий набор ролей должен сводиться к `["admin"]` (исключая `user`). | Must | `docs/auth.md:11-14`; `frontend-antd/src/entities/user/model/roles.ts:85-92`, `extractRoles` |
| FR-AUTH-006 | При отсутствии распознанных ролей в токене система должна назначать базовую роль `user`. | Must | `RoleClaims` поведение (по `docs/auth.md:64-95`, фронт-референс `roles.ts:94-110`) |

## Группа 2. Старт логина / регистрация

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-007 | `GET /api/v1/auth/login` должен быть доступен анонимному пользователю. | Must | `SecurityConfig.java:55-85` (PUBLIC_ENDPOINTS), `docs/auth.md:31` |
| FR-AUTH-008 | При `!sessions.oauthEnabled()` `GET /api/v1/auth/login` должен возвращать 400 с кодом `oidc_disabled`. | Must | `AuthController.java:69-76` |
| FR-AUTH-009 | `GET /api/v1/auth/login` должен определять `origin` по проксируемым заголовкам (`X-Forwarded-Proto`, `X-Forwarded-Host`, `Host`) и выбирать соответствующий `callbackUri`/`appUri` из allowlist. | Must | `AuthController.java:72,74`; `RequestOrigin.java:15-48`; `AppProperties.OAuth#callbackUriFor/appUriFor` |
| FR-AUTH-010 | При старте логина система должна сохранить состояние логина (state+hash и `code_verifier`, PKCE S256) в хранилище состояния с `expiresAt` = now + `loginStateTtl`. | Must | `AuthSessionService.startLogin/start:70-114` |
| FR-AUTH-011 | Система должна принимать `returnUrl` только в виде локального фрагмента `#...`. Если невалиден/содержит `#` дополнительно/пуст — использовать дефолтный `appUri`. | Must | `AuthSessionService.appUri:116-133` |
| FR-AUTH-012 | `GET /api/v1/auth/register` должен быть доступен анонимному и бросать 400 `oidc_disabled`, если OAuth недоступен. | Must | `AuthController.java:78-92` |
| FR-AUTH-013 | `GET /api/v1/auth/register` должен бросать 400 `registration_disabled`, если `oauth.registrationEnabled=false`. | Must | `AuthController.java:83-87` |
| FR-AUTH-014 | Старт регистрации должен использовать тот же механизм state/PKCE и вести на URL регистрации провайдера; callback для завершения — общий `/api/v1/auth/callback`. | Must | `AuthSessionService.startRegistration` → `start(..., true)`; `AuthController.register` |

## Группа 3. Callback, сессия, cookies

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-015 | `GET /api/v1/auth/callback` должен принимать `code`, `state`, `error`. При наличии `error` или отсутствии обязательных параметров — редирект с `?authError=1` на app URI соответствующего origin. | Must | `AuthController.java:107-118`, `164-168` |
| FR-AUTH-016 | При завершении логина система должна проверить состояние логина по хешу `state`: оно должно существовать и быть `usable(now)`. В случае невалидности/истечения — ApiException → редирект с `authError=1`, куки очищаются. | Must | `AuthSessionService.completeLogin:135-165`; `AuthController.java:120-134` |
| FR-AUTH-017 | После успешной валидации `state` система должна удалить состояние логина. | Must | `completeLogin:148-149` |
| FR-AUTH-018 | Обмен кода на токены (`access_token`, `refresh_token`, `id_token`) должен выполняться бэкендом через `OAuthTokenClient` с использованием `code_verifier` и `callbackUri` (из состояния или fallback). | Must | `completeLogin:150-151`, `callbackOf:167-171` |
| FR-AUTH-019 | По завершении успешного логина система должна создать серверную сессию (сохранить хеш `sessionId`, `subject`, `clientId`, токены) в хранилище сессий. Старые сессии старше `sessionTtl` удаляются. | Must | `completeLogin:152-163` |
| FR-AUTH-020 | Система должна выставить браузеру куки: `UK_SESSION` (значение `sessionId`), `UK_TOKEN` (access token). Обе — `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` если `oauth.cookieSecure=true`. `Domain` — опционально из конфига. | Must | `AuthCookies.java:29-110`; `docs/auth.md:51-67` |
| FR-AUTH-021 | Время жизни `UK_TOKEN` должно соответствовать оставшемуся времени жизни access-токена (минимум 1 мин при отрицательном). | Must | `AuthCookies.writeAccessToken:48-56` |
| FR-AUTH-022 | Время жизни `UK_SESSION` должно быть `sessionTtl`. | Must | `AuthCookies.writeSession:44-46` |
| FR-AUTH-023 | При любых ошибках callback (ApiException/RuntimeException) система должна очистить куки и редиректить с `authError=1`. | Must | `AuthController.java:124-134` |

## Группа 4. Восстановление сессии, refresh

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-024 | Аутентификация запроса из браузера должна выполняться по кукам `UK_SESSION`/`UK_TOKEN` через `SessionTokenFilter` (до/в связке с ресурс-сервером), с возможностью автоматического refresh. | Must | `SessionTokenFilter.java:41-139`; `SecurityConfig.java:133-139` |
| FR-AUTH-025 | Если `UK_SESSION` отсутствует — фильтр пропускает запрос (аноним). | Must | `SessionTokenFilter.doFilterInternal:90-100` |
| FR-AUTH-026 | Если сессия не найдена по хешу — фильтр должен очистить куки и пропустить запрос. | Must | `100-109` |
| FR-AUTH-027 | Если access-токен в куке валиден и не истекает ранее чем через `refreshWindow` — использовать его без refresh. | Must | `112-138`, `accessToken():140-164` |
| FR-AUTH-028 | Если токен истекает в пределах `refreshWindow` (или отсутствует/близок к истечению) — система должна выполнить `sessions.refresh(session)`, обновить `UK_TOKEN` в ответе и использовать новый токен для аутентификации. | Must | `140-164`, `AuthSessionService.refresh:226-240` |
| FR-AUTH-029 | Refresh должен использовать сохранённый `refresh_token` в сессии; при его отсутствии бросать `auth_session_unrenewable`. | Must | `refresh:228-235` |
| FR-AUTH-030 | При провале refresh (исключение) фильтр должен залогировать, не аутентифицировать запрос, закрыть сессию (`closeSession`) и очистить куки. | Must | `SessionTokenFilter.accessToken:155-164`, `doFilterInternal:112-123` |
| FR-AUTH-031 | Аутентификация из `UK_TOKEN` должна конвертироваться через `OidcJwtAuthenticationConverter` в `Authentication`. Если уже есть аутентифицированный контекст (не anonymous) — повторная конвертация не обязательна. | Must | `authenticate():166-194` |
| FR-AUTH-032 | Для bearer-токена (header) должен работать отдельный `BearerTokenResolver` (`CookieAwareBearerTokenResolver`), который читает `Authorization: Bearer ...` и dev-токен из cookie только в соответствующем контексте. CSRF-исключение срабатывает при наличии `Authorization` header. | Must | `SecurityConfig.bearerTokenResolver()`, `CookieAwareBearerTokenResolver` (по коду), `SecurityConfig:95-100` (CSRF ignoring when Authorization present) |

## Группа 5. Logout, dev-режим

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-033 | `POST /api/v1/auth/logout` должен быть доступен анонимному с CSRF-токеном (как указано в матрице). | Must | `SecurityConfig.PUBLIC_ENDPOINTS` включает `/api/v1/auth/logout`; `docs/auth.md:31` |
| FR-AUTH-034 | При logout система должна прочитать `UK_SESSION`, найти сессию (если есть), очистить все auth-куки (`UK_SESSION`, `UK_TOKEN`, `UK_DEV_TOKEN`), закрыть сессию (удалить, отозвать refresh token у IdP при наличии). | Must | `AuthController.logout:136-145`; `AuthCookies.clear:70-75`; `AuthSessionService.closeSession:205-224` |
| FR-AUTH-035 | В ответе `POST /api/v1/auth/logout` должен возвращаться `redirectUrl` (может быть `null` в dev-режиме, когда нет провайдера). | Must | `AuthController.LogoutResponse:156-157`; `logout:143` |
| FR-AUTH-036 | `POST /api/v1/auth/dev-login` доступен анонимному (с CSRF). Должен работать только если dev включён (`DevTokenController` доступен). Иначе 400 `dev_disabled`. | Must | `AuthController.devLogin:94-106`; `SecurityConfig.PUBLIC_ENDPOINTS` |
| FR-AUTH-037 | В dev-режиме система должна выставить `UK_DEV_TOKEN` (HttpOnly, SameSite=Lax, Secure по флагу) с TTL `DEV_AUTH_TOKEN_TTL`. | Must | `AuthCookies.writeDevToken:58-62`; `docs/auth.md:51-67` |
| FR-AUTH-038 | Dev-сессия в ответе содержит `subject`, `displayName`, `email`, `roles[]`, `expiresAt`. | Must | `AuthController.DevSession:152-154` |

## Группа 6. Разграничение доступа, профиль

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-039 | `GET /api/v1/me` должен возвращать 401 для анонимного. Для `user`/`admin` — профиль текущего пользователя. | Must | `docs/auth.md:32` |
| FR-AUTH-040 | Профиль `/api/v1/me` должен содержать `subject`, `displayName`, `email`, `roles[]`. | Must | `docs/auth.md:56-57` |
| FR-AUTH-041 | Роли из токена должны маппиться в `ROLE_ADMIN`/`ROLE_USER` при конвертации JWT; порядок поиска ролей — `rolesClaim` (если задан), иначе `roles`, `groups`, `realm_access.roles`, `resource_access.<audience>.roles` (по списку аудиторий). | Must | `docs/auth.md:64-95`; `security/RoleClaims` (по коду), `OidcJwtAuthenticationConverter` |
| FR-AUTH-042 | При маппинге ролей неизвестные значения игнорируются; `admin` имеет приоритет (нормализация). | Must | `docs/auth.md:89-95`, `roles.ts`-референс |
| FR-AUTH-043 | Защита по ролям на бэкенде: `/api/v1/admin/**`, `/api/v1/users`, `/api/v1/users/**` — только `ADMIN` (`hasRole("ADMIN")`). Прочие защищённые эндпоинты — `authenticated()`. UI-скрытие ролей — только UX. | Must | `SecurityConfig.java:110-130`; `docs/auth.md:35-38` |

## Группа 7. Безопасность, CSRF, домены

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-044 | Токены не должны храниться в `localStorage`, `sessionStorage`, DOM. Браузер получает только `HttpOnly` cookies. | Must | `docs/auth.md:42-50`, `AuthCookies` |
| FR-AUTH-045 | CSRF-защита: для не-GET запросов требуется `X-XSRF-TOKEN`, соответствующий `XSRF-TOKEN` cookie (`CookieCsrfTokenRepository` с `httpOnly=false`). | Must | `SecurityConfig:95-109`, `docs/auth.md:69-87` |
| FR-AUTH-046 | CSRF-проверка должна игнорироваться, если в запросе есть `Authorization` header (bearer). | Must | `SecurityConfig:97-100` |
| FR-AUTH-047 | `SameSite=Lax` для всех auth-кок. `Secure` — только при `oauth.cookieSecure=true`. | Must | `AuthCookies.base()`, `docs/auth.md:51-67`, `SecurityConfig.csrfTokenRepository` cookie customizer |
| FR-AUTH-048 | Определение origin из прокси-заголовков: берётся первый элемент при запятой (`X-Forwarded-Host`, `X-Forwarded-Proto`). Значение используется только для выбора из allowlist. | Must | `RequestOrigin.of:15-48` (комментарий) |
| FR-AUTH-049 | `appUriFor/callbackUriFor` при отсутствии совпадения origin с allowlist должны возвращать первый конфигурированный элемент (fallback). | Must | `AppProperties.OAuth.matchOrigin/originOf/split:210-290` |
| FR-AUTH-050 | `returnUrl` валидируется как локальный фрагмент — защита от открытого редиректа при callback. | Must | `AuthSessionService.appUri:116-133` |
| FR-AUTH-051 | Состояние логина (`state`) хранится в хранилище состояния в виде хеша, одноразово используется при callback. | Must | `AuthSessionService:70-114`, `135-165` |
| FR-AUTH-052 | Refresh-токен хранится только на стороне бэкенда (в хранилище сессий), никогда не попадает в cookie/ответ браузеру. | Must | `AuthSessionService.refresh`, `docs/auth.md:46-50` |
| FR-AUTH-053 | При logout система должна отозвать refresh-токен у IdP (`client.revokeRefreshToken`) с подавлением ошибок. | Must | `AuthSessionService.closeSession:211-224` |

## Группа 8. Ошибки/краевые

| ID | Требование | Приоритет | Источник |
|---|---|---|---|
| FR-AUTH-054 | Callback с `error` от IdP должен приводить к редиректу `?authError=1`. | Must | `AuthController.callback:115-118` |
| FR-AUTH-055 | Отсутствующие/пустые `code`/`state` в callback — `authError=1`. | Must | `115-118` |
| FR-AUTH-056 | Невалидный/истекший `state` — `authError=1`, куки очищены. | Must | `120-128` |
| FR-AUTH-057 | Ошибка при обмене кода/другие RuntimeException в callback — `authError=1`, куки очищены (с логированием). | Must | `128-134` |
| FR-AUTH-058 | Отключённый аккаунт/отклонение со стороны IdP при обработке токенов должно трактоваться как неуспешная аутентификация (конечный результат — 401 при попытке доступа к защищённому ресурсу или `authError=1` при потоке входа). | Should | `docs/auth.md:108-119` (disabled-user в realm), поведение фильтра/конвертера |
| FR-AUTH-059 | `mode=none` — конфиг возвращает `mode:"none"`, `/api/v1/auth/login` в oidc-ветке недоступен (но фронт при mode none не вызывает login через oidc). | Must | `AuthController.config:58-63`, `AuthController.login:69-76` |
| FR-AUTH-060 | При недоступном провайдере в dev-режиме недоступны oidc-эндпоинты; dev-login работает при `DEV_AUTH_ENABLED`. | Must | `AuthController.devLogin:97-106`, `properties.security().dev().enabled()` |
| FR-AUTH-061 | Запрос с невалидной сессией (не найдена) — анонимный доступ к публичным, 401 к защищённым. | Must | `SessionTokenFilter:100-109` |

## Ссылки на источники

- `docs/auth.md`
- `backend/src/main/java/com/acme/usermark/auth/AuthController.java`
- `backend/src/main/java/com/acme/usermark/auth/AuthSessionService.java`
- `backend/src/main/java/com/acme/usermark/auth/AuthCookies.java`
- `backend/src/main/java/com/acme/usermark/auth/RequestOrigin.java`
- `backend/src/main/java/com/acme/usermark/auth/SessionTokenFilter.java`
- `backend/src/main/java/com/acme/usermark/config/AppProperties.java`
- `backend/src/main/java/com/acme/usermark/config/SecurityConfig.java`
- `backend/src/main/java/com/acme/usermark/security/*`
- `keycloak/realm/user-kit-realm.json`
- `docker-compose.yml`, `nginx/templates/user-kit.conf.template`
- `frontend-antd/src/features/auth/cookie/cookieAuthProvider.ts`
- `frontend-antd/src/entities/user/model/roles.ts`