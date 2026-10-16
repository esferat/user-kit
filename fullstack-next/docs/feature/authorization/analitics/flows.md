# Диаграммы потоков авторизации

Все диаграммы — Mermaid `sequenceDiagram`. Язык русскоязычных комментариев/названий осознанно смешан с техническими идентификаторами/путями как в коде.

## 1. Вход (OIDC Authorization Code + PKCE через BFF)

```mermaid
sequenceDiagram
    autonumber
    participant Браузер as Браузер (frontend-antd)
    participant Бэкенд as Бэкенд BFF (/api/v1/auth)
    participant Хранилище as Хранилище состояния/сессий
    participant Keycloak as Keycloak (IdP)

    Браузер->>Бэкенд: GET /api/v1/auth/config
    Бэкенд-->>Браузер: {mode:"oidc", ..., registrationEnabled:...}

    Браузер->>Бэкенд: GET /api/v1/auth/login?returnUrl=#documents
    Note over Бэкенд: RequestOrigin.of(request) → определяет origin<br/>appUri = appUriFor(origin)+validFragment(returnUrl)<br/>callbackUri = callbackUriFor(origin)
    Бэкенд->>Хранилище: сохранить состояние логина (state+hash, code_verifier, appUri, callbackUri, expiresAt)
    Бэкенд-->>Браузер: 302 Location: Keycloak authorization URL (state, code_challenge=S256, redirect_uri=callbackUri)

    Браузер->>Keycloak: GET authorization (login/consent)
    Keycloak-->>Браузер: 302 Location: /api/v1/auth/callback?code=...&state=...

    Браузер->>Бэкенд: GET /api/v1/auth/callback?code&state
    Бэкенд->>Хранилище: найти состояние логина по хешу state, проверить usable(now)
    alt state валиден
        Бэкенд->>Хранилище: удалить состояние логина
        Бэкенд->>Keycloak: POST token (grant_type=authorization_code, code, code_verifier, redirect_uri)
        Keycloak-->>Бэкенд: access_token, refresh_token, id_token, expires_in
        Бэкенд->>Хранилище: завершить старые сессии (по политике TTL), создать новую сессию
        Бэкенд-->>Браузер: 302 Location: appUri (+фрагмент) + Set-Cookie UK_SESSION, UK_TOKEN (HttpOnly, SameSite=Lax, Secure?)
    else невалиден/истёк/error
        Бэкенд-->>Браузер: 302 Location: defaultAppUri?authError=1 + очистка кук (при наличии)
    end
```

## 2. Завершение логина (callback) — детали обработки ошибок

```mermaid
sequenceDiagram
    autonumber
    participant Браузер
    participant Бэкенд
    participant Хранилище as Хранилище состояния/сессий
    participant Keycloak

    Браузер->>Бэкенд: GET /api/v1/auth/callback?code&state | ?error=...
    alt error != null или code/state пустые
        Бэкенд-->>Браузер: 302 ?authError=1 (errorUrl(origin))
    else
        Бэкенд->>Хранилище: найти состояние логина по хешу state
        alt не найден или expired
            Бэкенд-->>Браузер: 302 ?authError=1 + clear cookies
        else
            Бэкенд->>Хранилище: удалить состояние логина
            Бэкенд->>Keycloak: exchange code
            alt успех
                Бэкенд->>Хранилище: создать сессию
                Бэкенд-->>Браузер: 302 appUri + Set-Cookie UK_SESSION, UK_TOKEN
            else ApiException/RuntimeException
                Note over Бэкенд: лог warn, очистка кук
                Бэкенд-->>Браузер: 302 ?authError=1 + clear
            end
        end
    end
```

## 3. Восстановление сессии при загрузке страницы

```mermaid
sequenceDiagram
    autonumber
    participant Браузер
    participant Фронт as frontend-antd
    participant Бэкенд

    Браузер->>Фронт: загрузка приложения
    Фронт->>Бэкенд: GET /api/v1/me (с куками UK_SESSION/UK_TOKEN при наличии)
    alt куки есть, сессия валидна, токен не требует refresh в ближайшем окне
        Бэкенд-->>Фронт: 200 {subject, displayName, email, roles[]}
        Note over Фронт: устанавливает currentUser
    else нет кук / сессия не найдена / токен невалиден после попыток
        Бэкенд-->>Фронт: 401
        Note over Фронт: currentUser = null
    end
```

## 4. Автоматическое обновление токена (refresh) до истечения

```mermaid
sequenceDiagram
    autonumber
    participant Браузер
    participant Бэкенд as SessionTokenFilter
    participant Хранилище as Хранилище сессий
    participant Keycloak

    Браузер->>Бэкенд: любой запрос (с UK_SESSION, UK_TOKEN)
    Бэкенд->>Хранилище: findSession(hash(UK_SESSION))
    alt сессия отсутствует
        Бэкенд->>Браузер: очистка кук, продолжить как аноним
    else
        Бэкенд->>Бэкенд: оценить expiresAt(access) vs now+refreshWindow
        alt токен валиден и жив > refreshWindow
            Бэкенд->>Бэкенд: аутентифицировать из UK_TOKEN (decode+converter)
            Бэкенд-->>Браузер: передать запрос дальше (200/403 в зависимости от прав)
        else
            Бэкенд->>Keycloak: POST token (grant_type=refresh_token, refresh_token)
            alt успех
                Keycloak-->>Бэкенд: новые access/id токены (+опц. refresh)
                Бэкенд->>Хранилище: обновить сессию (новые токены/время жизни)
                Бэкенд-->>Браузер: Set-Cookie UK_TOKEN (новый) + аутентификация новым токеном
            else ошибка
                Бэкенд->>Хранилище: закрыть сессию (с возможностью отзыва refresh при наличии), удалить
                Бэкенд-->>Браузер: очистка кук UK_SESSION/UK_TOKEN, продолжить как аноним
            end
        end
    end
```

## 5. Выход (logout) с ревокацией и post-logout redirect

```mermaid
sequenceDiagram
    autonumber
    participant Браузер
    participant Бэкенд
    participant Хранилище as Хранилище сессий
    participant Keycloak

    Браузер->>Бэкенд: POST /api/v1/auth/logout (с X-XSRF-TOKEN)
    Бэкенд->>Хранилище: прочитать UK_SESSION → найти сессию (опц.)
    Бэкенд->>Браузер: очистка кук UK_SESSION, UK_TOKEN, UK_DEV_TOKEN
    Бэкенд->>Хранилище: удалить сессию (если была)
    alt есть данные сессии для отзыва
        Бэкенд->>Keycloak: revoke refresh_token (POST revocation)
        Note over Бэкенд: ошибки подавляются (warn)
    end
    Бэкенд->>Keycloak: сформировать endSessionUrl(id_token, appUriFor(origin)) при наличии OAuth-клиента
    Бэкенд-->>Браузер: 200 {redirectUrl: ... или null}
    alt redirectUrl != null и непустой
        Браузер->>Keycloak: GET end_session_endpoint (post-logout)
        Keycloak-->>Браузер: редирект на post-logout redirect URI
    else
        Note over Браузер: остаётся на текущем приложении (dev-режим)
    end
```

## 6. Dev-login

```mermaid
sequenceDiagram
    autonumber
    participant Браузер
    participant Бэкенд
    participant Dev as DevTokenController

    Браузер->>Бэкенд: POST /api/v1/auth/dev-login {role?, subject?}
    alt DevTokenController доступен и dev включён
        Бэкенд->>Dev: issue(role, subject)
        Dev-->>Бэкенд: {accessToken, expiresAt, subject, displayName, email, roles}
        Бэкенд-->>Браузер: Set-Cookie UK_DEV_TOKEN (HttpOnly, SameSite=Lax, Secure?) + 200 DevSession
    else недоступен
        Бэкенд-->>Браузер: 400 {code:"dev_disabled", ...}
    end
```

## Примечания к диаграммам

- Обмен кода на токены всегда выполняется **бэкендом**, не браузером (BFF).
- `state` хранится в виде хеша в хранилище состояния логина; одноразовый.
- `returnUrl` — только **локальный фрагмент**.
- `UK_TOKEN` обновляется через `Set-Cookie` в ответе при refresh.
- CSRF применяется к не-GET (кроме запросов с `Authorization` header).