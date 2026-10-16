# Ошибки и краевые случаи

## Коды/состояния, специфичные для потока

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| Анонимный доступ к защищённому без сессии | 401 (`unauthorized`) с JSON `{code:"unauthorized", message:"Authentication is required", violations:[]}` | `SecurityConfig.writeUnauthorized/writeError` |
| Доступ к `/api/v1/users`/admin без ADMIN | 403 (`forbidden`) | `SecurityConfig.writeForbidden` |
| `GET /api/v1/auth/login` при `oauthEnabled=false` | 400 `{code:"oidc_disabled", message:"..."}` | `AuthController.login:69-76` |
| `GET /api/v1/auth/register` при `oauthEnabled=false` | 400 `oidc_disabled` | `78-87` |
| `GET /api/v1/auth/register` при `registrationEnabled=false` | 400 `registration_disabled` | `83-87` |
| `POST /api/v1/auth/dev-login` при недоступном DevTokenController | 400 `dev_disabled` | `97-106` |
| Refresh без refresh-токена в сессии | `ApiException` `auth_session_unrenewable` (в контексте refresh) → ведёт к завершению сессии | `AuthSessionService.refresh:228-235` |

## Callback-краевые

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| IdP вернул `error` (напр. `access_denied`) | Редирект на `appUri?authError=1`, куки не выставлены | `callback:115-118`, `164-168` |
| Отсутствует `code` или `state` (пустые) | Редирект `?authError=1` | `115-118` |
| `state` не найден | Редирект `?authError=1`, куки очищены | `120-128` |
| `state` истёк (`usable(now)=false`) | Редирект `?authError=1`, куки очищены | `120-128` |
| Ошибка при обмене кода (token exchange) | Редирект `?authError=1`, куки очищены, лог `warn` | `128-134` |
| RuntimeException в callback (провайдер недоступен) | Редирект `?authError=1`, куки очищены, лог `warn` | `128-134` |

## Сессия/refresh-краевые

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| `UK_SESSION` есть, но сессия отсутствует | Куки очищены, запрос продолжается анонимно | `SessionTokenFilter:100-109` |
| Access-токен в куке просрочен/невалиден при попытке аутентификации | Лог, `closeSession`, очистка кук, аноним | `112-123`, `166-194` |
| Refresh отклонён IdP (revocation/invalid_grant и др.) | Исключение → `closeSession` (revoke refresh с подавлением ошибок), очистка кук, аноним | `155-164`, `211-224` |
| Одновременные запросы в окне `refreshWindow` (гонка) | **Требует подтверждения** (OQ-AUTH-01): возможны множественные попытки обновления токена; требуется гарантия идемпотентности в хранилище сессий. | `AuthSessionService.refresh`, `SessionTokenFilter` |
| `UK_TOKEN` expiresAt уже в прошлом при записи | `AuthCookies.writeAccessToken` берёт `Duration.between(now, expiresAt)`; если отрицательный — `Duration.ofMinutes(1)` | `48-56` |

## Dev/режимы

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| `mode=none` | `/api/v1/auth/config` возвращает `mode:"none"`. OIDC-эндпоинты login/register/callback не стартуют (login бросает `oidc_disabled` при явном вызове). Dev-login доступен только если `DEV_AUTH_ENABLED`. | `config:58-63`, `login:69-76` |
| `oidcConfigured=false`, `devEnabled=true` | `mode:"dev"`. Фронт использует dev-поток. | `config:58-63` |
| `oidcConfigured=false`, `devEnabled=false` | `mode:"none"`. | `config:58-63` |

## Роли/claims

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| Токен без распознанных ролей | Назначается `user` | FR-AUTH-006, `RoleClaims`/`extractRoles` |
| Токен содержит `admin` и `user` | Результат — только `["admin"]` | FR-AUTH-005 |
| Роли в `resource_access.<audience>.roles` (несколько аудиторий) | Мержатся по порядку аудиторий из `OIDC_AUDIENCES`, значения нормализуются | `docs/auth.md:82-95`, фронт-референс |
| Неизвестные значения в roles-массивах | Игнорируются | `collectRoles`/нормализация |

## Безопасность/прокси

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| Некорректный/поддельный `X-Forwarded-Host` | Используется только для выбора из allowlist; при отсутствии совпадения берётся **первый** конфигурированный элемент (`fallback`). **Требует подтверждения** (OQ-AUTH-03). | `RequestOrigin.of`, `AppProperties.OAuth.matchOrigin` |
| `returnUrl` с внешним доменом | Игнорируется, используется дефолтный `appUri`. | `appUri:116-133` |
| Доступ к эндпоинту с `Authorization: Bearer ...` | CSRF не проверяется | `SecurityConfig:97-100` |
| Браузер без HTTPS при `cookieSecure=true` | Куки помечаются `Secure` — не будут передаваться по HTTP (ожидаемо) | `AuthCookies.base()`, `oauth.cookieSecure` |

## Dev-токен

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| `POST /api/v1/auth/dev-login` с пустым телом | Используется `{role:"user", subject:null}` | `AuthController.devLogin:101-106` |
| `UK_DEV_TOKEN` истекает | Фильтр/ресурс-сервер не продлевает его (в отличие от OIDC refresh) — поведение зависит от валидации dev-токена | `AuthCookies.writeDevToken`, `DevTokenController` |

## Прочие

| Сценарий | Ожидаемое поведение | Источник |
|---|---|---|
| Отключённый пользователь (disabled-user) в Keycloak | При завершении потока/валидации токена результат — неуспешная аутентификация. Конечный эффект: при доступе к защищённому → 401; при login-потоке — `authError=1` при ошибках обмена/валидации. | `keycloak/realm/user-kit-realm.json` (disabled-user), FR-AUTH-058 |
| Множественные домены (user-kit.local, user-kit.next.local) | Куки host-only; сессия одного домена не видна другому. Login продолжает тот домен, с которого начат (через origin + allowlist). | `docs/auth.md:131-148`, `nginx/template`, `AppProperties.OAuth` |
| Дубли redirectUris в realm-конфиге (localhost) | Артефакт конфига, не влияет на поведение. Зафиксировано как наблюдаемое (OQ-AUTH-04). | `keycloak/realm/user-kit-realm.json` |