/**
 * Имена иконок, используемые в приложении.
 *
 * Имена собраны в одном месте специально: `icons.test.ts` проверяет каждое из них
 * в поставляемых коллекциях SAP-icons, поэтому несуществующее имя иконки приведёт
 * к падению теста вместо отображения пустого прямоугольника с предупреждением в консоли.
 * Коллекции `@ui5/webcomponents-icons` содержат 705 иконок и не включают
 * `log-in`, `log-out` или `moon`, поэтому их пришлось заменить.
 */
export const ICONS = {
  documents: 'folder',
  users: 'group',
  account: 'account',
  lightTheme: 'light-mode',
  darkTheme: 'dark-mode',
  login: 'key',
  logout: 'away',
  upload: 'upload',
  download: 'download',
  refresh: 'refresh',
  delete: 'delete',
} as const;

export type IconName = (typeof ICONS)[keyof typeof ICONS];
