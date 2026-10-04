/**
 * Icon names used by the application.
 *
 * The names live in one place on purpose: `icons.test.ts` resolves every one of
 * them against the shipped SAP-icons collections, so a name that does not exist
 * fails the test run instead of rendering an empty box with a console warning.
 * The collections of `@ui5/webcomponents-icons` contain 705 icons and have no
 * `log-in`, `log-out` or `moon`, so those had to be replaced.
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
