# Итог

## Созданные документы

| Файл | Назначение |
|---|---|
| `README.md` | Обзор фичи Authorization: назначение, scope/in-out, действующие лица, глоссарий, артефакты, открытые вопросы |
| `functional-requirements.md` | Функциональные требования с ID `FR-AUTH-xxx`, группировка по областям, приоритет, источник |
| `user-stories-and-cases.md` | Пользовательские истории `US-AUTH-xx` и сценарии использования в формате Given/When/Then |
| `flows.md` | Диаграммы Mermaid sequenceDiagram: login (OIDC+PKCE через BFF), callback, восстановление сессии, автоматический refresh, logout с ревокацией, dev-login |
| `access-matrix.md` | Матрица доступа «эндпоинт/операция × аноним/user/admin» по SecurityConfig и docs/auth.md |
| `errors-and-edge-cases.md` | Ошибки, callback-краевые, сессия/refresh, dev-режимы, роли/claims, прокси, домены |
| `api-contract.md` | Контракт реально используемых фронтендом эндпоинтов: config/login/register/callback/dev-login/logout/me, куки, CSRF, заголовки прокси |
| `non-functional-security.md` | Нефункциональные и security-требования: хранение токенов, CSRF, cookie-атрибуты, TTL, PKCE/state, origin allowlist, серверный контроль |

## Трассируемость (сводно)

Все функциональные требования имеют ID `FR-AUTH-xxx` и ссылки на источники в репозитории: `docs/auth.md`, `backend/src/main/java/com/acme/usermark/auth/*`, `backend/src/main/java/com/acme/usermark/config/*`, `backend/src/main/java/com/acme/usermark/security/*`, `keycloak/realm/user-kit-realm.json`, `docker-compose.yml`, `nginx/templates/user-kit.conf.template`, `frontend-antd/src/features/auth/cookie/cookieAuthProvider.ts`, `frontend-antd/src/entities/user/model/roles.ts`.

## Открытые вопросы

См. раздел «Открытые вопросы (требуют подтверждения)» в `README.md`:
- OQ-AUTH-01 — гонка при множественных refresh в `refreshWindow`
- OQ-AUTH-02 — поведение при провале refresh (что считать «rejected»)
- OQ-AUTH-03 — fallback на первый элемент allowlist при несоответствии origin
- OQ-AUTH-04 — дубли redirectUris/webOrigins в realm-конфиге
- OQ-AUTH-05 — роль по умолчанию при отсутствии распознанных ролей (`user`)
- OQ-AUTH-06 — релевантность `registrationEnabled` при `mode!=oidc`
- OQ-AUTH-07 — `redirectUrl=null` при logout в dev-режиме
- OQ-AUTH-08 — граница CSRF-исключения (только по `Authorization` header) в dev-контексте

## Что вне scope

- Регистрация как отдельная фича (рассмотрена только провайдерская `/auth/register`)
- Изменение конфигурации Keycloak/ролей в IdP
- Изменение кода бэкенда/фронта (только аналитика)
- Управление пользователями `/api/v1/users` (отдельный контур)

Документация написана на русском языке, идентификаторы эндпоинтов/полей/классов/ролей сохранены латиницей как в коде. Диаграммы в Mermaid. Все выводы основаны исключительно на фактическом поведении из репозитория.