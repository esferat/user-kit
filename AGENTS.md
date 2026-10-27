# AGENTS.md — user-kit

Монорепозиторий: одно Next.js-приложение, один REST-бэкенд, локальная инфраструктура (Keycloak, PostgreSQL,
S3-совместимое хранилище, nginx-edge, Elasticsearch/Kibana/Logstash). Приложение управляет
**файлами**: загрузка, список, скачивание, аватар, администрирование пользователей.

Подробная документация — в [`docs/`](docs/): `api.md`, `architecture.md`, `auth.md`, `frontend.md`,
`deployment.md`. README — для человека, этот файл — для агента.

## Карта репозитория

| Путь | Стек | Назначение |
| --- | --- | --- |
| `backend/` | Spring Boot 4.1.1, Java 21, Maven, Flyway, PostgreSQL, гексагональная архитектура | REST API `/api/v1`, OAuth-клиент, файловое хранилище |
| `frontend-main/` | Next.js 16.4, React 19, antd 6, three.js, Phaser | Единственное приложение: `user-kit.local` и `user-kit.next.local` (профиль, админка, игры) |
| `user-profile/` | Modern.js 3.10, React 19, antd 6, TanStack Query, zod, FSD | Микрофронтенд правки профиля: `user-kit.profile.local`, remote Module Federation для `frontend-main` |
| `nginx/` | nginx 1.27 | TLS-edge: терминация, редирект, прокси |
| `keycloak/realm/` | Keycloak 26 | Импорт realm'а локального IdP |
| `logstash/` | Logstash | Доставка логов backend/Keycloak/nginx в Elasticsearch |
| `vector/` | Vector 0.60 | Доставка логов фронтендов (frontend-main, user-profile) в Elasticsearch |
| `scripts/` | PowerShell | `generate-dev-cert.ps1` (сертификаты), `smoke.ps1` (e2e-проверка стека) |
| `docs/` | — | Единственный источник правды по API, архитектуре и фронтендам |

## Домены и порты

| Домен | Что отдаёт |
| --- | --- |
| `https://user-kit.local` | frontend-main + `/api/`, `/auth/` (Keycloak), `/healthz` |
| `https://user-kit.next.local` | frontend-main (без `/auth`, он редиректится на канонический домен) |
| `https://user-kit.profile.local` | user-profile (микрофронтенд: страницы, `/profile-api/`, чанки Module Federation) |
| `https://user-kit.kibana.local` | Kibana |

Порты: edge `80/443`, backend `8080`, Keycloak `8180`, PostgreSQL `5432`, Silo `9001`,
Elasticsearch `9200`, Kibana `5601`, user-profile `3001`; dev-сервер: next `3000`.

## Команды

```bash
docker compose up -d --build          # весь стек
pwsh ./scripts/generate-dev-cert.ps1  # самоподписанный сертификат (один раз)
pwsh ./scripts/smoke.ps1              # e2e: edge, IdP, роли, загрузка, поиск, блокировки
cp .env.example .env                  # конфигурация окружения
```

Локальная разработка (сервисы в Docker, код из исходников) — см. README, раздел «Local development»:
`docker compose up -d postgres object-storage`, затем `pnpm dev` (next),
`mvn spring-boot:run -Dspring-boot.run.profiles=dev` (backend).

## Общие правила

- **Сессия в cookie, токенов в браузере нет.** Бэкенд — OAuth-клиент: сам обменивает код на токены,
  раздаёт `httpOnly`-cookie. Не добавляй в фронтенд `client_secret`, `access_token` или конфиг IdP.
- **Роли ровно две:** `admin` и `user`. Любая проверка прав — на сервере; фронтенд только прячет UI.
- **Формат ответов API:** коллекции — `PageResult{items,total,page,size}`, параметры `page`, `size`,
  `search`, `sort`; конкурентные изменения — `If-Match`/`ETag`; ошибка — единый JSON
  `{timestamp,status,code,message,path,violations}`.
- **`frontend-main` следует Feature Sliced Design**
  (`app → pages → widgets → features → entities → shared`). Границы слоёв ESLint не проверяет —
  держи руками: слой не импортирует выше себя, чужие слайсы — только через публичный API
  (`index.ts`), глубокие импорты запрещены.
- **Версии зафиксированы:** Next 16, React 19, antd 6, Spring Boot 4.1, Java 21,
  PostgreSQL 17, Elasticsearch 8.15. Не обновляй major-версии без запроса.
- **Бэкенд — гексагональная архитектура:** `domain/` (чистый Java, порты) → `application/`
  (use cases) → `adapters/` (JPA, S3, OIDC, REST). Зависимости только внутрь; подробности в
  `backend/AGENTS.md` и `docs/architecture.md`.
- **Граница `application/` — DTO:** на вход команды и `CallerContext`, на выход `FileDto`/`AccountDto`/
  `ProfileDto` (это и есть JSON ответа). Агрегаты домена наружу не выходят.
- **Пакеты — по зонам ответственности** (`file`, `profile`, `account`, `auth`, `dev`) и одинаково
  названы в каждом слое: модель зоны, её use case, её контроллер и её адаптер стоят рядом.
- **Коммиты — только по явной просьбе пользователя.**
- Комментарии в коде — на языке соседних файлов: бэкенд по-английски, фронтенды по-русски.

## Локальные особенности

- Сертификат самоподписанный → для `curl` нужен `-k`, в браузере — «принять и перейти».
- Имена доменов должны быть в `C:\Windows\System32\drivers\etc\hosts` (или `/etc/hosts`).
- `NEXT_PUBLIC_*` инлайнится **на этапе сборки** — после правки переменной нужен
  `docker compose up -d --build frontend-main`.
- Логи: Kibana, индексы `user-kit-backend-*`, `user-kit-keycloak-*`, `user-kit-nginx-*`,
  `user-kit-frontend-main-*`, `user-kit-user-profile-*`.

## Проверка перед сдачей

| Область | Команда |
| --- | --- |
| backend | `docker run --rm -v userkit-m2:/root/.m2 -v "$PWD/backend:/workspace" -w /workspace maven:3.9-eclipse-temurin-21 mvn -B -ntp clean test` (с `clean`: без него сборка может пройти по устаревшим классам) |
| frontend-main | `pnpm lint`, `pnpm build` (tsc проверяется при сборке) |
| весь стек | `pwsh ./scripts/smoke.ps1` |

Игры в `frontend-main/src/features/*` (lines, match3) **не имеют тестов в репозитории** — их
проверяют временными harness'ами на esbuild + puppeteer (логика движка выносится в чистые
модули `game/engine.ts`, `game/*Storage.ts`, которые тестируются без браузера).
