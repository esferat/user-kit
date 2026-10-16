# Пользовательские истории и сценарии использования

Формат сценариев: **Given / When / Then**. ID: `US-AUTH-xx`.

## Истории

| ID | Кто | Я хочу | Чтобы | Примечание |
|---|---|---|---|---|
| US-AUTH-01 | Аноним | Увидеть доступные способы входа | Выбрать подходящий (OIDC/dev/none) | Основано на `/api/v1/auth/config` |
| US-AUTH-02 | Аноним | Начать вход через IdP | Пройти аутентификацию без хранения токенов в браузере | BFF-поток, PKCE+state |
| US-AUTH-03 | Аноним | Зарегистрироваться через IdP (если доступно) | Создать учётку и сразу войти | Провайдерская регистрация |
| US-AUTH-04 | Пользователь | Восстановить сессию после перезагрузки страницы | Остаться авторизованным без повторного входа | Куки + автоматический refresh |
| US-AUTH-05 | Пользователь | Автоматически продлить сессию незадолго до истечения токена | Не потерять работу | `refreshWindow` |
| US-AUTH-06 | Пользователь | Выйти из системы | Завершить сессию локально и у IdP | `POST /api/v1/auth/logout` |
| US-AUTH-07 | Админ | Получить доступ к административному функционалу | Управлять пользователями | Ролевая проверка |
| US-AUTH-08 | Dev-клиент | Войти в dev-режиме с выбранной ролью | Быстро протестировать доступы | `POST /api/v1/auth/dev-login` |

## Use cases

### UC-AUTH-01: Успешный вход через OIDC

**ID:** US-AUTH-02a  
**Given:** `mode=oidc`, `oauthEnabled=true`, браузер анонимен, есть валидный `returnUrl` `#documents`  
**When:** GET `/api/v1/auth/login?returnUrl=%23documents` → редирект на IdP с `state`+PKCE; пользователь вводит корректные креды → IdP редиректит на `/api/v1/auth/callback?code=...&state=...`  
**Then:**
- Сохранено состояние логина (state+hash, code_verifier), удалено после использования.
- Код обменян бэкендом, создана сессия, выставлены `UK_SESSION`, `UK_TOKEN` (HttpOnly, SameSite=Lax, Secure по флагу).
- Редирект на `appUri+#documents`.

**Источник:** FR-AUTH-007-023

### UC-AUTH-02: Callback с ошибкой от IdP

**Given:** Возврат от IdP с `error=access_denied`  
**When:** GET `/api/v1/auth/callback?error=access_denied&state=...`  
**Then:** Редирект на `appUri?authError=1`, куки не выставлены/очищены.  
**Источник:** FR-AUTH-015,054

### UC-AUTH-03: Невалидный/истекший state

**Given:** State не найден или истёк  
**When:** GET `/api/v1/auth/callback?code=abc&state=bad`  
**Then:** ApiException → редирект `?authError=1`, состояние логина не используется повторно, куки очищены.  
**Источник:** FR-AUTH-016,017,056

### UC-AUTH-04: returnUrl не локальный фрагмент

**Given:** `returnUrl=https://evil.com/path` или `#/x#y` (невалидный)  
**When:** Старт логина  
**Then:** Система игнорирует и использует дефолтный `appUri`.  
**Источник:** FR-AUTH-011,050

### UC-AUTH-05: Восстановление сессии при перезагрузке

**Given:** Есть валидные куки `UK_SESSION`, `UK_TOKEN`; сессия есть; токен жив > `refreshWindow`  
**When:** Браузер делает первый запрос к защищённому ресурсу  
**Then:** `SessionTokenFilter` аутентифицирует из куки, без refresh, контекст установлен.  
**Источник:** FR-AUTH-024-027,061

### UC-AUTH-06: Автоматический refresh перед истечением

**Given:** Токен истекает через 30с при `refreshWindow=90s`  
**When:** Любой запрос с куками  
**Then:** Фильтр вызывает `refresh`, выставляет новый `UK_TOKEN` в `Set-Cookie`, аутентифицирует новым токеном.  
**Источник:** FR-AUTH-028,029

### UC-AUTH-07: Refresh отклонён провайдером

**Given:** Refresh-токен недействителен/отозван у IdP  
**When:** Попытка refresh  
**Then:** Исключение → `closeSession`, очистка кук `UK_SESSION`/`UK_TOKEN`, запрос идёт анонимным.  
**Источник:** FR-AUTH-030,053,057

### UC-AUTH-08: Сессия не найдена в БД

**Given:** `UK_SESSION` есть в куке, но сессия отсутствует  
**When:** Запрос  
**Then:** Фильтр очищает куки, продолжает как аноним.  
**Источник:** FR-AUTH-026,061

### UC-AUTH-09: Успешный logout

**Given:** Авторизован через OIDC, есть сессия  
**When:** `POST /api/v1/auth/logout` с валидным CSRF-токеном  
**Then:** Куки очищены, сессия удалена, refresh-токен отозван у IdP (если возможно), ответ содержит `redirectUrl` (на post-logout IdP или null в dev).  
**Источник:** FR-AUTH-033-035,053

### UC-AUTH-10: Dev-login

**Given:** `mode=dev`, `DEV_AUTH_ENABLED=true`, аноним  
**When:** `POST /api/v1/auth/dev-login` с `{role:"admin"}`  
**Then:** Выдан `UK_DEV_TOKEN` (HttpOnly), ответ содержит профиль с ролями. Фронт восстанавливает сессию через `/api/v1/me`? (по коду фронта devLogin выставляет currentUser локально, но также возможно восстановление через me — см. cookieAuthProvider).  
**Источник:** FR-AUTH-036-038

### UC-AUTH-11: Доступ к /me

**Given:** Аноним без кук  
**When:** GET `/api/v1/me`  
**Then:** 401  
**Given:** Аутентифицированный user  
**When:** GET `/api/v1/me`  
**Then:** 200 с `{subject, displayName, email, roles:[...]}`  
**Источник:** FR-AUTH-039,040

### UC-AUTH-12: Ролевая проверка

**Given:** Аутентифицированный user (только ROLE_USER)  
**When:** Доступ к `/api/v1/users`  
**Then:** 403 (AccessDenied)  
**Given:** Аутентифицированный admin  
**When:** Доступ к `/api/v1/users`  
**Then:** 200  
**Источник:** FR-AUTH-043

### UC-AUTH-13: Маппинг ролей из claims

**Given:** Токен с `realm_access.roles=["admin","sales"]`  
**When:** Конвертация JWT  
**Then:** Роли → `ROLE_ADMIN`; нормализация даёт `["admin"]`.  
**Given:** Токен без распознанных ролей  
**When:** Конвертация  
**Then:** Базовая `ROLE_USER`.  
**Источник:** FR-AUTH-041,042,006,005

### UC-AUTH-14: CSRF для не-GET

**Given:** Аутентифицирован через куки (не bearer), нет `X-XSRF-TOKEN`  
**When:** `POST /api/v1/files` (защищённый)  
**Then:** 403/CSRF error (зависит от конфигурации Spring Security) — требуется заголовок при наличии cookie-based сессии.  
**Given:** Запрос с `Authorization: Bearer ...`  
**When:** POST  
**Then:** CSRF не проверяется.  
**Источник:** FR-AUTH-045,046

### UC-AUTH-15: mode=none / oidc_disabled

**Given:** `mode=none`  
**When:** Фронт запрашивает `/api/v1/auth/config`  
**Then:** `mode:"none"`, `oidcConfigured` может быть false. Попытка вызвать `/api/v1/auth/login` вернёт 400 `oidc_disabled`.  
**Источник:** FR-AUTH-059,008

### UC-AUTH-16: Регистрация недоступна

**Given:** `oauth.registrationEnabled=false` или `oidc` недоступен  
**When:** GET `/api/v1/auth/register`  
**Then:** 400 `registration_disabled` или `oidc_disabled`.  
**Источник:** FR-AUTH-012,013,003