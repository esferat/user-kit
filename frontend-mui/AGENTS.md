# AGENTS.md — frontend-mui

Vite 8 + React 19 + TypeScript 5.9 + Material UI 7 + emotion + Redux Toolkit. Второй SPA:
`https://user-kit.mui.local`. Пакет `npm`, Node ≥ 22.12.

Приложение повторяет экраны `frontend-antd` (documents, login, users) и ходит в тот же API, но
живёт по правилам MUI и Redux Toolkit.

## Структура (Feature Sliced Design)

```
src/
├── app/        App, тема MUI, ErrorBoundary, startup, провайдер Redux
├── pages/      documents, login, users
├── widgets/    app-shell, documents-table, users-table
├── features/   auth, file-upload, file-download, user-role, theme-switch, locale-switch
├── entities/   user, file — доменные модели и REST-вызовы
├── shared/     api, config, i18n, lib, ui
└── main.tsx
```

Границы слоёв, публичный API слайсов, порядок импортов и остальные правила ESLint — те же, что в
`frontend-antd/eslint.config.mjs` (слой не импортирует выше себя, глубокие импорты запрещены,
`import-x/order`, `consistent-type-imports`, `explicit-function-return-type`).

## Отличия от antd-версии

- **Состояние — Redux Toolkit**: слайсы в `shared/lib/store`/`app/model`, доступ через хуки
  `useAppSelector`/`useAppDispatch`. MobX здесь не используется.
- **UI — MUI**: `ThemeProvider`/`createTheme` в `app/ui`, свои темы и `sx`-стили, `Grid`/`Stack`
  вместо antd `Space`/`Row`. Не приноси antd-компоненты в это приложение.
- Тема и локаль — в `app/ui` и `shared/i18n`; стили — CSS-модули/`sx`.
- Комментарии и JSDoc — на русском.

## Общее с API

- REST — только через `shared/api/http.ts`; ответы — `PageResult{items,total,page,size}`,
  параметры `page`, `size`, `search`, `sort`.
- Сессия в cookie, токенов в браузере нет; роли `admin`/`user` только прячут UI.

## Команды

```bash
npm run dev            # http://localhost:5175, прокси /api → http://localhost:8080
npm run check          # format:check → lint → typecheck → vitest  (то, что нужно перед сдачей)
npm run build          # tsc --noEmit + vite build → dist/
npm run test:coverage
```

`VITE_*` инлайнятся в бандл на этапе сборки — после правки `.env.local` нужен
`docker compose up -d --build frontend-mui`.
