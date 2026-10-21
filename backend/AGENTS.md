# AGENTS.md — backend

Spring Boot 4.1.1, Java 21, Maven, Spring Security (JWT resource server + OAuth-клиент),
Spring Data JPA, Flyway, PostgreSQL 17, AWS SDK v2 (S3-совместимое хранилище), springdoc (OpenAPI).

Пакет: `com.acme.usermark`. Архитектура — **гексагональная (ports & adapters)**: ядро в центре,
зависимости всегда направлены внутрь. Подробности — в [`../docs/architecture.md`](../docs/architecture.md).

## Структура

```
com.acme.usermark/
├── domain/            ядро, чистый Java: агрегаты, правила, порты (интерфейсы)
│   ├── account/       Account, AccountRoles, Caller + порт AccountRepository
│   ├── auth/          AuthSession, LoginState, TokenSet + порты SessionRepository,
│   │                  LoginStateRepository, IdentityProvider
│   ├── file/          FileObject, FileUpload + порты FileRepository, FileStorage
│   └── shared/        DomainException, Etag, PageResult
├── application/       сценарии использования: зависят только от домена и портов
│   ├── account/       CurrentAccountService, AccountAdminUseCases, AccountDto,
│   │                  CallerContext, UpdateAccountCommand
│   ├── auth/          AuthenticationUseCases, OAuthSettings
│   ├── file/          FileUseCases, FileDto, FileSettings, UploadFileCommand,
│   │                  UpdateFileCommand
│   ├── profile/       ProfileUseCases, ProfileDto, AvatarImages, UpdateProfileCommand
│   └── shared/        IdentitySettings
├── adapters/
│   ├── in/
│   │   ├── web/       общий веб-слой: ApiError, ApiExceptionHandler, ReadOnlyFields, Uploads
│   │   │   ├── file/     FileController
│   │   │   ├── profile/  MeController
│   │   │   ├── account/  UserAdminController
│   │   │   ├── auth/     AuthController
│   │   │   └── dev/      DevTokenController
│   │   └── security/   AuthCookies, RequestOrigin, SessionTokenFilter, CallerResolver,
│   │                   OidcJwtAuthenticationConverter, RoleAuthorities
│   └── out/
│       ├── persistence/  строки, мапперы и репозитории по зонам
│       │   ├── file/     FileObjectRow, FileObjectRowRepository, FileMapper, JpaFileRepository
│       │   ├── account/  UserAccountRow, UserAccountRowRepository, AccountMapper,
│       │   │             JpaAccountRepository
│       │   └── auth/     AuthSessionRow, AuthLoginStateRow, их репозитории, AuthMapper,
│       │                 JpaSessionRepository, JpaLoginStateRepository
│       ├── storage/   S3FileStorage (реализует FileStorage)
│       ├── identity/  OAuthIdentityProvider, DisabledIdentityProvider
│       └── dev/       DevTokenIssuer, DemoDataSeeder, SimplePdf
└── config/            SecurityConfig, AppProperties, JWT/OIDC/S3-конфигурация, StartupValidator
```

**Зоны ответственности** (`file`, `profile`, `account`, `auth`, `dev`) названы одинаково в каждом
слое: модель зоны, её use case, её контроллер и её адаптер лежат рядом по имени. Внутри зоны
модели и команды отделены от use case'ов и контроллеров: `FileDto` (модель) и `FileUseCases`
(сценарий) лежат в `application/file`, `FileController` (контроллер) — в `adapters/in/web/file`.

## Правила

- **`domain/` не знает о фреймворках**: ни Spring, ни JPA, ни Jackson, ни servlet API. Агрегаты,
  порты и значение-объекты — обычные классы. Новый порт — интерфейс в `domain/`, его реализация —
  в `adapters/out/`.
- **Граница слоя `application/` — DTO.** На вход — команды (`UploadFileCommand`, `UpdateFileCommand`,
  `UpdateProfileCommand`, `UpdateAccountCommand`) и вызывающий (`CallerContext`: id, email, признак
  администратора); на выход — DTO (`FileDto`, `AccountDto`, `ProfileDto`). DTO — это и есть JSON
  ответа, веб-адаптер его только сериализует. **Агрегаты домена не выходят наружу:** ни контроллер,
  ни фильтр, ни DTO не держит `Account` или `FileObject`. `null` в команде означает «не менять».
- **`application/` знает только про порты.** Единственные аннотации Spring в этом слое —
  `@Transactional` и синхронизация транзакции для очистки аватара: граница транзакции должна
  охватывать несколько портов (объектное хранилище и база).
- **Ошибки — `DomainException`** с `Kind` и кодом; статус ответа выбирает веб-адаптер
  (`ApiExceptionHandler`). Не пробрасывай наружу свои исключения и не импортируй
  `org.springframework.http.HttpStatus` в домен.
- **Маппинг JPA — в адаптере.** `*Row` — это строки таблиц, домен о них не знает. Адаптер
  `Jpa*Repository` переводит строку в агрегат и обратно и отвечает за оптимистическую блокировку
  (`@Version`): при расхождении версий — `ObjectOptimisticLockingFailureException` (500, как и раньше).
- **`MultipartFile` не попадает в домен**: веб-адаптер превращает запрос в `FileUpload`
  (`adapters/in/web/Uploads`), лимит размера проверяется до чтения байтов.
- **Вызывающий не известен домену**: `CallerResolver` (в security-адаптере) отдаёт `Caller`
  (subject + claims), use cases работают с `Account`.
- **Коллекции — `PageResult<T>`**, параметры `page`/`size`/`search`/`sort`; `size` ограничивается
  `REST_MAX_PAGE_SIZE` (обрезается, не отклоняется).
- **Конкуренция — `ETag`/`If-Match`**: `Etag.of(version)` и `Etag.verify(ifMatch, version)`;
  иначе `412 precondition_failed`.
- **Роли только `admin` и `user`** (`AccountRoles`); права задаёт `SecurityConfig`:
  `/api/v1/admin/**`, `/api/v1/users/**` — `hasRole("ADMIN")`, остальное — `authenticated()`.
  Не проверяй права вручную в контроллере.
- **CSRF включён** (`CookieCsrfTokenRepository`): cookie `XSRF-TOKEN` + заголовок `X-XSRF-TOKEN`
  для изменяющих запросов; запросы с заголовком `Authorization` от CSRF освобождены.
- **Сессия в cookie**: `SessionTokenFilter` + `BearerTokenResolver` принимают и `Authorization`,
  и cookie. Токены в браузер не отдаются.
- **Миграции Flyway** — `src/main/resources/db/migration/V<n>__имя.sql`. Уже применённые миграции
  не правь, добавляй новую. Схема не меняется: агрегаты отображаются на те же таблицы.
- **Секреты и IdP-конфигурация — только через env** (`OIDC_*`, `DEV_AUTH_SECRET`, `S3_*`).
  `DEV_AUTH_ENABLED=true` и `/api/v1/dev/**` существуют только в профиле `dev`.
- **Комментарии — на английском**, как в существующих файлах бэкенда.

## Настройка и провайдеры

- `AppProperties` — единственный источник конфигурации; use cases получают значения через
  `FileSettings`, `IdentitySettings`, `OAuthSettings` (бины в `config/ApplicationConfiguration`).
- `IdentityProvider` — порт логина. `OAuthIdentityProvider` работает, когда
  `app.security.oauth.enabled=true`, иначе поднимается `DisabledIdentityProvider` — приложение
  стартует и без OAuth-клиента.
- `DomainException.upstream(code, message)` — 502; коды: `identity_provider_error`, `storage_unavailable`.

## Версии и их смысл

В `pom.xml` зафиксированы `jackson-bom 3.2.3`, `jackson-2-bom 2.22.3`, `tomcat 11.0.27`,
`logback 1.6.5`, `netty 4.2.18.Final`, `slf4j 2.0.19` — это патчи безопасности поверх версий,
которыми управляет Spring Boot 4.1.1. Комментарии в `pom.xml` объясняют, почему каждая
версия нужна; **не откатывай и не «упрощай» их без чтения комментария**.

## Сборка и тесты

```bash
# без локального Maven — через образ (кэш в томе userkit-m2)
docker run --rm -v userkit-m2:/root/.m2 -v "$PWD/backend:/workspace" -w /workspace \
  maven:3.9-eclipse-temurin-21 mvn -B -ntp clean test

# локальный запуск (нужны Java 21 и Maven 3.9+)
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

**Всегда запускай `clean`**: без него инкрементальная компиляция может собраться против устаревших
классов и скрыть ошибку (например, ссылку на удалённый пакет).

Тесты лежат рядом с кодом и повторяют его структуру: `adapters/in/web`, `application/file`,
`domain`... Юнит-тесты мокают порты (`FileRepository`, `FileStorage`, `IdentityProvider`), поэтому
адаптер JPA проверяется только на живом стенде — прогоняй `scripts/smoke.ps1`.

Swagger UI: `/swagger-ui/index.html`, OpenAPI: `/v3/api-docs`. Логи пишутся в формате
`[level]-[date]- message` (LOG_FILE) — этот формат разбирает Logstash, не меняй его без правки
пайплайна в `logstash/`.
