import type { Messages } from '../i18n';

/**
 * Русский словарь — исходный язык приложения. Каждый ключ этого файла
 * должен существовать и в остальных локалях, это проверяет `i18n.test.ts`.
 */
export const ru: Messages = {
  'app.title': 'User Kit',
  'app.sessionRestoreFailed': 'Не удалось восстановить сессию',
  'app.notConfigured': 'Приложение не настроено',
  'app.startFailed': 'Приложение не удалось запустить',
  'app.hint.configuration':
    'Укажите переменные в frontend-antd/.env.local для "npm run dev" или пересоберите образ с такими же аргументами сборки, например VITE_API_BASE_URL.',
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

  'login.subtitle': 'Файлы и пользователи на Ant Design',
  'login.description':
    'Доступ к приложению защищён OAuth 2.0 / OpenID Connect: вход выполняет backend, браузер получает только httpOnly cookies.',
  'login.noProvider': 'Backend не настроен ни на один способ входа. Проверьте OIDC_CLIENT_ENABLED и DEV_AUTH_ENABLED.',
  'login.devWarning':
    'Режим разработки: вход выполняется локально, без Identity Provider (роль {role}). Не включайте его в production.',
  'login.role.label': 'Роль для входа',
  'login.role.admin': 'Администратор',
  'login.role.user': 'Пользователь',
  'login.submit': 'Войти',
  'login.failed': 'Не удалось выполнить вход',
};
