# Бриф для агента — backend

Один экран перед работой с сервисом. Жёсткие правила кода — в [`../AGENTS.md`](../AGENTS.md),
контракт API — в [`contract_map_v1.md`](contract_map_v1.md), архитектура всего стенда — в
[`../../docs/architecture.md`](../../docs/architecture.md).

## Что это

REST-бэкенд `user-kit`: Spring Boot 4.1.1, Java 21, PostgreSQL 17, S3-совместимое хранилище,
Keycloak как источник идентичности. Один сервис обслуживает **три** фронтенда
(`frontend-antd`, `frontend-mui`, `fullstack-next`) на трёх доменах и работает как OAuth-клиент:
браузер получает только `httpOnly`-cookie, токены живут на сервере.

Прикладные возможности: список/загрузка/скачивание/переименование/удаление файлов, профиль
вызывающего и аватар в двух размерах, администрирование пользователей (роли `admin`/`user`,
включение/выключение), вход через IdP и локальный dev-вход.

Архитектура — **гексагональная**: `domain/` (чистый Java, порты) → `application/` (сценарии,
DTO) → `adapters/` (JPA, S3, OIDC, REST). Зависимости только внутрь. Пакеты разложены по
зонам ответственности `file`, `profile`, `account`, `auth`, `dev`, и зоны названы одинаково
в каждом слое.

## Состояние на 2026-10-23

| Проверка | Результат |
| --- | --- |
| `mvn -B -ntp clean test` | 166 тестов, 0 падений |
| `scripts/smoke.ps1` на живом стенде | 110 проверок пройдено |
| Схема БД | 4 миграции Flyway, `ddl-auto: validate` |
| Готово | OAuth-вход + dev-вход, сессии и refresh, файлы, аватар, админка пользователей, OpenAPI, health |
| Не сделано | нет тестов JPA-адаптера (проверяется только smoke), нет серверной пагинации (фильтр/сортировка/страница в памяти) |

Рабочее дерево на момент написания: бэкенд закоммичен (`004474d9`), незакоммичены только новые
каталоги `docs/` в проектах. Сверяйся с кодом, а не с историей коммитов.

## Стек и версии

`spring-boot-starter-web` (Tomcat 11, virtual threads), `spring-boot-starter-security`
(JWT resource server + OAuth2 client), Spring Data JPA, Flyway, PostgreSQL 17, AWS SDK v2 (S3),
springdoc (OpenAPI 3), `java.awt`/ImageIO для аватара (PNG/JPEG/GIF/BMP, без WebP).

Версии `jackson-bom`, `tomcat`, `logback`, `netty`, `slf4j` в `pom.xml` — патчи безопасности
поверх управляемых Spring Boot версий. У каждой есть комментарий; не откатывай их.

## Карта кода

```
src/main/java/com/acme/usermark/
├── UserKitApplication.java
├── domain/
│   ├── account/   Account, AccountRoles, Caller; порт AccountRepository
│   ├── auth/      AuthSession, LoginState, TokenSet; порты SessionRepository,
│   │              LoginStateRepository, IdentityProvider
│   ├── file/      FileObject, FileUpload; порты FileRepository, FileStorage
│   └── shared/    DomainException (Kind + code), Etag, PageResult
├── application/
│   ├── account/   CurrentAccountService, AccountAdminUseCases, AccountDto,
│   │              CallerContext, UpdateAccountCommand
│   ├── auth/      AuthenticationUseCases, OAuthSettings
│   ├── file/      FileUseCases, FileDto, FileSettings, UploadFileCommand, UpdateFileCommand
│   ├── profile/   ProfileUseCases, ProfileDto, AvatarImages, UpdateProfileCommand
│   └── shared/    IdentitySettings
├── adapters/
│   ├── in/web/            ApiError, ApiExceptionHandler, ReadOnlyFields, Uploads
│   │   ├── file/          FileController
│   │   ├── profile/       MeController
│   │   ├── account/       UserAdminController
│   │   ├── auth/          AuthController
│   │   └── dev/           DevTokenController
│   ├── in/security/       AuthCookies, RequestOrigin, SessionTokenFilter, CallerResolver,
│   │                      OidcJwtAuthenticationConverter, RoleAuthorities
│   └── out/
│       ├── persistence/   file/, account/, auth/ — *Row, мапперы, Jpa*Repository
│       ├── storage/       S3FileStorage
│       ├── identity/      OAuthIdentityProvider, DisabledIdentityProvider
│       └── dev/           DevTokenIssuer, DemoDataSeeder, SimplePdf
└── config/                SecurityConfig, AppProperties, ApplicationConfiguration,
                           StartupValidator, JWT/OIDC/S3-конфигурация
```

Тесты повторяют структуру (`src/test/java/...`): `domain`, `application/*`, `adapters/*`.
Юнит-тесты мокают порты; адаптер JPA и хранилище проверяются на стенде.

## Путь запроса

```
HTTP → SessionTokenFilter (cookie → Bearer) → SecurityConfig (роль)
     → Controller (PATCH-payload, MultipartFile → FileUpload)
     → CallerResolver/Caller → CurrentAccountService.resolve → CallerContext
     → Use case (@Transactional): правила, Etag.verify, порты
     → Jpa*Repository / S3FileStorage / OAuthIdentityProvider
     → FileDto / AccountDto / ProfileDto → JSON
```

Ошибки домена — `DomainException` с `Kind` и стабильным кодом; HTTP-статус выбирает
`ApiExceptionHandler`. Агрегаты (`Account`, `FileObject`) не покидают `application/`.

## Куда добавлять изменения

| Задача | Куда |
| --- | --- |
| Новый эндпоинт | контроллер в `adapters/in/web/<зона>`, сценарий в `application/<зона>` |
| Новое правило/инвариант | `domain/<зона>` (агрегат или value object) |
| Новый внешний сервис | интерфейс-порт в `domain/`, реализация в `adapters/out/` |
| Новый ответ API | DTO в `application/<зона>` + сериализация из контроллера |
| Новая ошибка | `DomainException` с существующим `Kind` или добавь `Kind` (статус — в адаптере) |
| Новая таблица/колонка | миграция `V<n>__имя.sql`, строка `*Row` в `adapters/out/persistence/<зона>` |
| Новая настройка | поле в `AppProperties` + `application.yml` с `${ENV:default}` |

## Команды

```bash
# сборка и тесты (без локального Maven, кэш в томе userkit-m2)
MSYS_NO_PATHCONV=1 docker run --rm -v userkit-m2:/root/.m2 \
  -v "D:/Projects/test/user-kit/backend:/workspace" -w /workspace \
  maven:3.9-eclipse-temurin-21 mvn -B -ntp clean test

# локальный запуск
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# образ и стенд
MSYS_NO_PATHCONV=1 docker compose build backend
MSYS_NO_PATHCONV=1 docker compose up -d backend
pwsh ./scripts/smoke.ps1
```

`clean` обязателен: инкрементальная компиляция иначе собирается против устаревших классов и
скрывает ссылки на удалённые пакеты.

## Грабли

1. **`domain/` не импортирует Spring, JPA, Jackson, servlet.** Проверяй `grep` перед сдачей.
2. **`application/` не держит `Account`/`FileObject` в публичных сигнатурах** — только команды,
   `CallerContext` и DTO. `null` в команде означает «не менять».
3. **`MultipartFile` не доходит до use case** — `Uploads` превращает его в `FileUpload`/команду,
   лимит проверяется до чтения байтов.
4. **Права — в `SecurityConfig`**, не в контроллере. Владение файлом проверяют use cases
   (чужой файл → 404, не 403).
5. **`If-Match`** проверяется через `Etag.verify` → 412. Расхождение `@Version` на уровне JPA
   даёт `ObjectOptimisticLockingFailureException` → 500 (историческое поведение, менять только
   осознанно).
6. **PATCH отклоняет read-only поля** (`ReadOnlyFields`), а неизвестное поле — `bad_request`
   (`fail-on-unknown-properties`). Не «упрощай» это до молчаливого игнорирования.
7. **Коллекции — `PageResult`**, `size` обрезается до `REST_MAX_PAGE_SIZE`, а не отклоняется.
8. **Секреты и IdP — только env.** `/api/v1/dev/**` существует только при `DEV_AUTH_ENABLED=true`.
9. **Формат логов** `[level]-[date]- message` разбирает Logstash; менять только вместе с
   `logstash/pipeline`.
10. **Swagger и `/v3/api-docs` публичны** намеренно; в проде закрываются на edge.

## Ограничения и долги

- Список файлов и пользователей фильтруется и сортируется **в памяти** после полной выборки —
  нормально для стенда, не для больших объёмов.
- JPA-адаптер не покрыт тестами: его контракт подтверждает `scripts/smoke.ps1`.
- Аватар принимает только то, что декодирует ImageIO (PNG/JPEG/GIF/BMP); WebP отклоняется.
- `frontend-antd` и `frontend-mui` не читают поля аватара и `checksum` — см.
  [`contract_map_v1.md`](contract_map_v1.md), раздел «Расхождения».
