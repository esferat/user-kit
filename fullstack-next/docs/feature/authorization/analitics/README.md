# Authorization — аналитическая документация (fullstack-next)

## Назначение фичи

Фича **Authorization** реализует в `fullstack-next` cookie-based BFF-авторизацию через Keycloak (OIDC Authorization Code + PKCE), восстановлением сессии, автоматическим обновлением токенов, выходом, поддержкой dev-режима и разграничением доступа по ролям. Фронтенд не хранит токены в JS — бэкенд сам является OAuth-клиентом и отдаёт только `HttpOnly` cookies.

## Границы фичи (scope / out of scope)

**В scope:**
- Настройка и поведение авторизационного потока через BFF: `GET /api/v1/auth/config`, `GET /api/v1/auth/login`, `GET /api/v1/auth/register`, `GET /api/v1/auth/callback`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/dev-login`, `GET /api/v1/me`.
- Хранение сессии в куки: `UK_SESSION`, `UK_TOKEN`, `UK_DEV_TOKEN` (атрибуты HttpOnly, SameSite=Lax, Secure по флагу).
- PKCE + state, валидация state, обмен кода бэкендом с `client_secret` (Basic Auth).
- Автоматический refresh access-токена в `SessionTokenFilter` при приближении истечения (`refreshWindow`).
- CSRF: `XSRF-TOKEN` cookie (не HttpOnly) + заголовок `X-XSRF-TOKEN` для не-GET запросов; исключение — `Authorization` header / dev-режим.
- Роли: ровно `admin`, `user`. Маппинг из claims, нормализация (если есть admin — только admin).
- Определение `origin` из проксируемых заголовков (`X-Forwarded-Proto`, `X-Forwarded-Host`, `Host`) и выбор callback/app URI по allowlist.
- Обработка ошибок: редирект на `?authError=1`, очистка кук при невалидном состоянии/refresh/rejected.

**Вне scope:**
- Самостоятельная регистрация в приложении (registration — отдельная фича; в данной фиче рассматривается только провайдерская регистрация `/auth/register` через Keycloak).
- Изменение конфигурации Keycloak/роли в IdP (только чтение фактической конфигурации).
- Изменение кода бэкенда/фронта (аналитика — только документирование).
- Управление пользователями через `/api/v1/users` (отдельный контур).

## Действующие лица

- **Аноним** — неаутентифицированный браузер/клиент.
- **user** — аутентифицированный с ролью `user` (или получивший базовую роль).
- **admin** — аутентифицированный с ролью `admin`.
- **Keycloak/IdP** — провайдер OIDC (локальный в compose).
- **Бэкенд BFF** — `backend` (Spring Boot), выступает OAuth-клиентом и ресурс-сервером.
- **Фронтенд** — `frontend-antd` (референс), браузер.

## Глоссарий

| Термин | Описание |
|---|---|
| BFF | Backend-for-Frontend. Бэкенд выступает OAuth-клиентом; браузер получает только HttpOnly cookies. |
| OIDC | OpenID Connect. Authorization Code + PKCE в этой реализации. |
| PKCE | Proof Key for Code Exchange (S256). |
| CSRF | Защита от межсайтовых запросов. `XSRF-TOKEN` + `X-XSRF-TOKEN`. |
| State | Хеш state и code_verifier хранятся в хранилище состояния логина (state/session store), проверяется при callback. |
| Session | Серверная сессия, идентифицируемая по `UK_SESSION`. Хэш сессии и связанные данные хранятся в логическом хранилище сессий. |
| Access token | Короткоживущий токен, хранится в `UK_TOKEN` (HttpOnly). |
| Refresh token | Хранится в логическом хранилище сессий и используется только бэкендом для обновления access-токена. |
| returnUrl | Только локальный фрагмент `#...`, иначе заменяется на дефолтный URI. |
| Origin allowlist | Список разрешённых frontend origin/callback/app URI из конфига (plurals/singular). |
| Claim mapping | Порядок извлечения ролей из токена. |

## Использованные артефакты

- `docs/auth.md` — полное описание поведения.
- `backend/src/main/java/com/acme/usermark/auth/*` — `AuthController`, `AuthSessionService`, `AuthCookies`, `RequestOrigin`, `SessionTokenFilter`, `AuthSession`, `TokenSet`, `OAuthTokenClient` (по коду).
- `backend/src/main/java/com/acme/usermark/config/AppProperties.java`, `SecurityConfig.java`, `CookieAwareBearerTokenResolver.java`.
- `backend/src/main/java/com/acme/usermark/security/RoleClaims.java`, `OidcJwtAuthenticationConverter.java`.
- `keycloak/realm/user-kit-realm.json` — клиенты/роли/учётки.
- `docker-compose.yml`, `nginx/templates/user-kit.conf.template` — домены, маршрутизация.
- `frontend-antd/src/features/auth/cookie/cookieAuthProvider.ts`, `frontend-antd/src/entities/user/model/roles.ts` — референс поведения фронта.
- `fullstack-next/docs/feature/authorization/prompts/development/context-prompt.md` — замысел реализации.

## Открытые вопросы (требуют подтверждения)

| № | Вопрос | Почему неоднозначно | Предлагаемое действие |
|---|---|---|---|
| OQ-AUTH-01 | Точный момент/критичность `refreshWindow` (90s по дефолту) и поведение при множественных параллельных запросах | В `SessionTokenFilter` обновление происходит при `expiresAt <= now+refreshWindow`; при гонке несколько запросов могут пытаться обновить токен. Нужна гарантия идемпотентности/блокировки в хранилище сессий. | Проверить реализацию `refresh` на предмет конкурентного доступа (по идентификатору сессии). |
| OQ-AUTH-02 | Поведение при провале refresh (provider отклоняет) — всегда ли чистим куки и считаем сессию недействительной? | `SessionTokenFilter` ловит `RuntimeException`, логирует, возвращает `null`, затем `closeSession` + `clear()`. Но возможны сетевые таймауты vs 4xx от IdP. | Уточнить, что именно считается «rejected» (какой код/исключение). |
| OQ-AUTH-03 | Точное соответствие allowlist fallback: `matchOrigin` возвращает `candidates.get(0)` при отсутствии совпадения. Значит ли это, что неизвестный `Host`/origin приведёт к редиректу на первый конфигурированный фронтенд? | Потенциально важно для безопасности (open redirect-подобное поведение в выборе целевого app URI). Комментарий в коде говорит «fallback to first configured entry», намеренно. | Подтвердить допустимость fallback-логики (не уводим ли на посторонний домен при некорректном прокси-заголовке). |
| OQ-AUTH-04 | Дубли в `keycloak/realm/user-kit-realm.json` redirectUris/webOrigins для localhost (5174 дублируется). Это артефакт конфига или осознанный? | Не влияет на поведение, но создаёт шум при анализе. | Зафиксировать как артефакт импорта, не менять. |
| OQ-AUTH-05 | Роль при отсутствии распознанных ролей в токене — всегда `user` (базовая). Соответствует ли это бизнес-правилу (все аутентифицированные минимально `user`)? | При пустом результате назначается `user`. Также в матрице `/api/v1/me` доступен `user`/`admin`. | Считать требованием: «токен без распознанной роли получает роль `user`». |
| OQ-AUTH-06 | В `/config` поле `registrationEnabled` зависит от наличия OIDC и включённой регистрации. При `oidcConfigured=false` в ответе `mode` может быть `dev`/`none`, но `registrationEnabled` будет `false`. Корректно ли фронту полагаться на это? | Фронт проверяет `mode !== 'oidc' ? throw ...` для register. | Уточнить, что `registrationEnabled` в конфиге релевантен только когда `mode==='oidc'`. |
| OQ-AUTH-07 | Для `POST /api/v1/auth/logout` в dev-режиме `redirectUrl` может быть `null` (LogoutResponse). Фронт при непустом редиректит. Поведение ок — но нужно ли что-то дополнительно? | В dev-режиме при отсутствии OAuth-клиента `endSessionUrl` отсутствует → `redirectUrl` может быть `null`. | Зафиксировать как наблюдаемое поведение. |
| OQ-AUTH-08 | CSRF-исключения: CSRF игнорируется при наличии `Authorization` header. Соответствует ли это намерению «только Authorization header исключает CSRF»? | В SecurityConfig CSRF игнорируется при наличии `Authorization` header. | Подтвердить границу исключения. |

## Трассируемость (сводно)

См. `functional-requirements.md` (FR-AUTH-xxx с ID и источниками). Также трассировка представлена в соответствующих файлах.