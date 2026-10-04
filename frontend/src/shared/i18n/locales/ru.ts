import type { Messages } from '../i18n';

/**
 * Russian dictionary, the source language of the application. Every key of this
 * file has to exist in every other locale as well, which `i18n.test.ts` checks.
 */
export const ru: Messages = {
  'app.title': 'User Kit',
  'app.sessionRestoreFailed': 'Не удалось восстановить сессию',
  'app.notConfigured': 'Приложение не настроено',
  'app.startFailed': 'Приложение не удалось запустить',
  'app.hint.configuration':
    'Укажите переменные в frontend/.env.local для "npm run dev" или пересоберите образ с такими же аргументами сборки, например VITE_AUTH_MODE=dev.',
  'app.hint.generic': 'Подробности смотрите в консоли браузера и в логе backend.',

  'common.cancel': 'Отмена',
  'common.unknownError': 'Неизвестная ошибка',

  'format.units.bytes': 'Б',
  'format.units.kb': 'КБ',
  'format.units.mb': 'МБ',
  'format.units.gb': 'ГБ',
  'format.units.tb': 'ТБ',

  'locale.name': 'Русский',
  'locale.switchTo': 'Сменить язык: {locale}',

  'nav.documents': 'Документы',
  'nav.adminUsers': 'Пользователи',

  'shell.sideNavigation': 'Основная навигация',
  'shell.profile': 'Профиль {name}',
  'shell.logout': 'Выйти',
  'shell.theme.light': 'Светлая тема',
  'shell.theme.dark': 'Тёмная тема',

  'roles.admin': 'Администратор',
  'roles.user': 'Пользователь',

  'documents.title': 'Документы',
  'documents.upload': 'Загрузить',
  'documents.refresh': 'Обновить список',
  'documents.search': 'Поиск по имени',
  'documents.sort.label': 'Сортировка',
  'documents.sort.newest': 'Сначала новые',
  'documents.sort.oldest': 'Сначала старые',
  'documents.sort.name': 'По имени',
  'documents.sort.sizeDesc': 'По размеру (убывание)',
  'documents.table.label': 'Список документов',
  'documents.table.empty': 'Файлов пока нет',
  'documents.column.name': 'Имя',
  'documents.column.size': 'Размер',
  'documents.column.type': 'Тип',
  'documents.column.owner': 'Владелец',
  'documents.column.updated': 'Изменён',
  'documents.action.download': 'Скачать',
  'documents.action.delete': 'Удалить',
  'documents.message.downloaded': 'Файл «{name}» скачан',
  'documents.message.deleted': 'Файл «{name}» удалён',
  'documents.message.uploaded': {
    one: 'Загружен {count} файл',
    few: 'Загружено {count} файла',
    many: 'Загружено {count} файлов',
    other: 'Загружено {count} файлов',
  },
  'documents.upload.title': 'Загрузка файла',
  'documents.upload.description': 'Описание (необязательно)',
  'documents.upload.placeholder': 'Выберите файл',

  'users.title': 'Пользователи',
  'users.refresh': 'Обновить',
  'users.table.label': 'Список пользователей',
  'users.table.empty': 'Пользователей пока нет',
  'users.column.email': 'Email',
  'users.column.name': 'Имя',
  'users.column.role': 'Роль',
  'users.column.enabled': 'Активен',
  'users.column.updated': 'Изменён',
  'users.row.roleLabel': 'Роль пользователя {email}',
  'users.row.enabledLabel': 'Пользователь {email} активен',
  'users.message.roleUpdated': 'Роль пользователя {email} изменена: {role}',

  'login.subtitle': 'Файлы и пользователи на SAPUI5',
  'login.description': 'Доступ к приложению защищён авторизацией через Identity Provider (Keycloak, OIDC).',
  'login.devWarning': 'Режим разработки: используется dev-токен backend (роль {role}). Не включайте его в production.',
  'login.missingAuthority': 'Не задан VITE_OIDC_AUTHORITY. Скопируйте .env.example в .env и укажите адрес IdP.',
  'login.submit': 'Войти',
  'login.failed': 'Не удалось выполнить вход',
};
