# Матрица доступа Authorization

Основано на `docs/auth.md:25-38` и `SecurityConfig.java:110-130`.

## Публичные/ограниченные эндпоинты авторизации и системные

| Эндпоинт/операция | Аноним | user | admin | Примечание |
|---|---|---|---|---|
| `GET /actuator/health`, `/actuator/health/**`, `/actuator/info` | allowed | allowed | allowed | системные |
| `GET /v3/api-docs`, `/v3/api-docs/**`, `/swagger-ui.html`, `/swagger-ui/**` | allowed | allowed | allowed | API-документация |
| `GET /api/v1/dev/**` | allowed when `DEV_AUTH_ENABLED=true` | allowed | allowed | dev-утилиты |
| `GET /api/v1/auth/config` | allowed | allowed | allowed | конфигурация режимов |
| `GET /api/v1/auth/login` | allowed | allowed | allowed | старт OIDC; при `oauthEnabled=false` → 400 `oidc_disabled` |
| `GET /api/v1/auth/register` | allowed | allowed | allowed | старт регистрации; при недоступности → 400 |
| `GET /api/v1/auth/callback` | allowed | allowed | allowed | обработка OIDC-редиректа |
| `POST /api/v1/auth/dev-login` | allowed (с CSRF-токеном) | allowed | allowed | только dev; при недоступности → 400 `dev_disabled` |
| `POST /api/v1/auth/logout` | allowed (с CSRF-токеном) | allowed | allowed | очищает куки/сессию |

## Защищённые эндпоинты приложения

| Эндпоинт/операция | Аноним | user | admin | Примечание |
|---|---|---|---|---|
| `GET /api/v1/me` | 401 | own profile | own profile | возвращает профиль текущего |
| `GET /api/v1/files` | 401 | own files | all files | по матрице файлов (контекст фичи авторизации) |
| `GET /api/v1/files/{id}/content` | 401 | own files | all files | — |
| `DELETE /api/v1/files/{id}` | 401 | own files | all files | — |
| `GET /api/v1/Users`, `GET /api/v1/Users/{id}` | 401 | 403 | allowed | управление пользователями (вне основного scope Authorization, но фиксируется) |
| `/api/v1/admin/**` | 401/403 | 403 | allowed | требует ROLE_ADMIN |

## Ролевые требования к методу

- `hasRole("ADMIN")` для: `/api/v1/admin/**`, `/api/v1/users`, `/api/v1/users/**` (SecurityConfig).
- Остальные защищённые — `authenticated()`. Фильтрация «own/all» для файлов реализуется на уровне бизнес-логики (не только в SecurityConfig).
- UI-скрытие элементов для не-admin — **только UX**, серверный контроль обязателен.

## Ссылки

- `docs/auth.md:25-38`
- `backend/src/main/java/com/acme/usermark/config/SecurityConfig.java:110-130`