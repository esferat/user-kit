# Feature documentation & prompts — fullstack-next

Индекс фич приложения `fullstack-next` (монорепо `user-kit`). Для каждой фичи здесь лежат её
**промты-контексты** (подпапка `prompts/`) и — по мере работы — **документация и тесты** фичи.

## Структура

```
fullstack-next/docs/feature/
├── README.md                                       # этот индекс
├── authorization/
│   ├── prompts/
│   │   ├── development/context-prompt.md           # разработка: вход, сессия, выход, роли
│   │   ├── analize/context-prompt.md               # аналитик: документация на фичу
│   │   └── test/context-prompt.md                  # тестировщик: тестовая документация
│   ├── analitics/                                  # артефакты аналитика (по промту analize)
│   └── test/                                       # артефакты тестировщика (по промту test)
└── registration/
    ├── prompts/
    │   ├── development/context-prompt.md           # разработка: саморегистрация через Keycloak
    │   ├── analize/context-prompt.md               # аналитик: документация на фичу
    │   └── test/context-prompt.md                  # тестировщик: тестовая документация
    ├── analitics/
    └── test/
```

Каждый промт — **самодостаточный**: его можно целиком передать агенту. Построен по схеме:

```
[SYSTEM / ROLE] → [CRITICAL_RULES] → [REPO_MAP] → [CURRENT_TASK]
    → [ACCEPTANCE_CRITERIA] → [OUTPUT_FORMAT]
```

## Как использовать

| Задача | Файл |
| --- | --- |
| Реализовать вход/сессию/выход/роли | `authorization/prompts/development/context-prompt.md` |
| Написать документацию на авторизацию | `authorization/prompts/analize/context-prompt.md` |
| Написать тесты на авторизацию | `authorization/prompts/test/context-prompt.md` |
| Реализовать регистрацию | `registration/prompts/development/context-prompt.md` |
| Написать документацию на регистрацию | `registration/prompts/analize/context-prompt.md` |
| Написать тесты на регистрацию | `registration/prompts/test/context-prompt.md` |

Порядок работы над фичей: `analize` (требования) → `development` (реализация) → `test` (проверка).

## Куда складываются артефакты

- Документация аналитика — в `fullstack-next/docs/feature/<feature>/analitics/` (файлы `README.md`,
  `functional-requirements.md`, `flows.md`, `api-contract.md` и т.д.).
- Тестовая документация — в `fullstack-next/docs/feature/<feature>/test/`.
- Промты фичи — в `fullstack-next/docs/feature/<feature>/prompts/<role>/`.

## Ключевые допущения (общие для всех промтов)

- Архитектура: **BFF через Spring-бэкенд** — браузер ходит по httpOnly cookie, токены в клиент не
  попадают; Keycloak-клиент `user-kit-bff` (confidential, Authorization Code + PKCE).
- Регистрация — функция провайдера (Keycloak), включается **двумя** флагами:
  `registrationAllowed` (realm) и `OIDC_REGISTRATION_ENABLED` (бэкенд).
- Структура фронтенда: **Feature-Sliced Design** — слои `app/pages/widgets/features/entities/shared`,
  слайсы `kebab-case`, сегменты `ui/model/api/lib/config`, public API через `index.ts`.
- Целевой домен: `https://user-kit.next.local` (локально — `http://localhost:3000`).
- Next.js 16.4 — требует чтения `node_modules/next/dist/docs/`; `middleware.ts` → `proxy.ts`.
- Роли ровно две: `admin`, `user`; авторизация — на сервере, скрытие UI — только UX.
- `returnUrl` бэкенд принимает только как `#`-фрагмент → возврат на корень приложения.

## Ссылки на документацию репозитория

Из `fullstack-next/docs/feature/` (три уровня вверх — корень монорепо):

- `../../../docs/auth.md` — поведение авторизации, Keycloak, claim-маппинг, self registration.
- `../../../docs/api.md`, `../../../docs/architecture.md`, `../../../docs/deployment.md`.
- `../../../frontend-antd/src/features/auth/` — референс BFF-провайдера и маппинга ролей.
