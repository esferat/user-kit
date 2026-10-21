# AGENTS.md — frontend-antd

Vite 8 + React 19 + TypeScript 5.9 + Ant Design 6 + MobX 6. Канонический SPA: `https://user-kit.local`.
Пакет `npm`, Node ≥ 22.12.

## Структура (Feature Sliced Design)

```
src/
├── app/        точка сборки: App, провайдеры темы, ErrorBoundary, startup, сервисы
├── pages/      documents, login, users — маршруты верхнего уровня
├── widgets/    app-shell, documents-table, users-table
├── features/   auth, file-upload, file-download, user-role, theme-switch, locale-switch
├── entities/   user, file — доменные модели и вызовы REST API
├── shared/     api (http-клиент), config, i18n, lib (format, message, router, store), ui
└── main.tsx
```

Правила, которые проверяет ESLint (`eslint.config.mjs`) — их нельзя обходить:

- **Слой не импортирует выше себя**: `app` не импортирует `pages`, `pages` не импортирует
  `widgets`, и т.д.
- **Только публичный API слайса**: `@/entities/user`, а не `@/entities/user/model/roles`.
- **Глубокие импорты запрещены** (`@/layer/a/b/c`).
- **Внутри слайса** — не выше одного уровня: `../../*` запрещено, `../*` можно.
- **Порядок импортов** (`import-x/order`): builtin → external → internal → parent → sibling → index →
  type; между группами пустая строка, типы — отдельными `import type`.
- Циклы запрещены (`import-x/no-cycle`), `import-x/no-relative-packages`.
- `consistent-type-imports` (типы — отдельным `import type`), `explicit-function-return-type`
  (кроме стрелочных выражений), `eqeqeq`, `curly`, `no-console` (только `warn`/`error`).
- Тесты лежат рядом с кодом: `*.test.ts(x)`, Vitest + Testing Library.

## Состояние и данные

- MobX: сторы в `shared/lib/store` и `app/model`, реактивные наблюдатели — `observer`.
- REST — только через `shared/api/http.ts`; ответы — `PageResult{items,total,page,size}`.
  Страница/поиск/сортировка — параметрами `page`, `size`, `search`, `sort`.
- Сессия в cookie, авторизация на сервере; роли `admin`/`user` только прячут UI.

## Стиль

- Тема и локаль — в `app/ui/AppThemeProvider.tsx` и `shared/i18n`; стили в `app/styles/app.css`
  и CSS-модулях рядом с компонентами.
- Тексты пользователя — через i18n (`shared/i18n/locales`), не хардкодь строки в компонентах.
- Комментарии и JSDoc — на русском, как в существующих файлах.

## Команды

```bash
npm run dev            # http://localhost:5174, прокси /api → http://localhost:8080
npm run check          # format:check → lint → typecheck → vitest  (то, что нужно перед сдачей)
npm run build          # tsc --noEmit + vite build → dist/
npm run test:coverage
```

`VITE_*` переменные инлайнятся в бандл на этапе сборки — после правки `.env.local` нужен
`docker compose up -d --build frontend-antd`.
