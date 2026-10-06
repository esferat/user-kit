import type { Messages } from '../i18n';

/** Английский словарь. `i18n.test.ts` падает, если здесь нет ключа. */
export const en: Messages = {
  'app.title': 'User Kit',
  'app.sessionRestoreFailed': 'Could not restore the session',
  'app.notConfigured': 'The application is not configured',
  'app.startFailed': 'The application failed to start',
  'app.hint.configuration':
    'Set the variables in frontend/.env.local for "npm run dev", or rebuild the image with matching build arguments, for example VITE_API_BASE_URL.',
  'app.hint.generic': 'Check the browser console and the backend log for details.',

  'common.cancel': 'Cancel',
  'common.unknownError': 'Unknown error',

  'format.units.bytes': 'B',
  'format.units.kb': 'KB',
  'format.units.mb': 'MB',
  'format.units.gb': 'GB',
  'format.units.tb': 'TB',

  'locale.name': 'English',
  'locale.switchTo': 'Switch language: {locale}',

  'nav.documents': 'Documents',
  'nav.adminUsers': 'Users',

  'shell.sideNavigation': 'Main navigation',
  'shell.profile': 'Profile {name}',
  'shell.logout': 'Sign out',
  'shell.theme.light': 'Light theme',
  'shell.theme.dark': 'Dark theme',

  'roles.admin': 'Administrator',
  'roles.user': 'User',

  'documents.title': 'Documents',
  'documents.upload': 'Upload',
  'documents.refresh': 'Refresh list',
  'documents.search': 'Search by name',
  'documents.sort.label': 'Sort by',
  'documents.sort.newest': 'Newest first',
  'documents.sort.oldest': 'Oldest first',
  'documents.sort.name': 'By name',
  'documents.sort.sizeDesc': 'By size (descending)',
  'documents.table.label': 'Document list',
  'documents.table.empty': 'No files yet',
  'documents.column.name': 'Name',
  'documents.column.size': 'Size',
  'documents.column.type': 'Type',
  'documents.column.owner': 'Owner',
  'documents.column.updated': 'Modified',
  'documents.action.download': 'Download',
  'documents.action.delete': 'Delete',
  'documents.message.downloaded': 'File "{name}" downloaded',
  'documents.message.deleted': 'File "{name}" deleted',
  'documents.message.uploaded': {
    one: 'Uploaded {count} file',
    other: 'Uploaded {count} files',
  },
  'documents.upload.title': 'Upload file',
  'documents.upload.description': 'Description (optional)',
  'documents.upload.placeholder': 'Choose a file',

  'users.title': 'Users',
  'users.refresh': 'Refresh',
  'users.table.label': 'User list',
  'users.table.empty': 'No users yet',
  'users.column.email': 'Email',
  'users.column.name': 'Name',
  'users.column.role': 'Role',
  'users.column.enabled': 'Enabled',
  'users.column.updated': 'Modified',
  'users.row.roleLabel': 'Role of user {email}',
  'users.row.enabledLabel': 'User {email} is enabled',
  'users.message.roleUpdated': 'Role of user {email} changed to {role}',

  'login.subtitle': 'Files and users on SAPUI5',
  'login.description':
    'Access is protected with OAuth 2.0 / OpenID Connect: the backend signs the user in and the browser only receives httpOnly cookies.',
  'login.devWarning':
    'Development mode: the login happens locally, without an identity provider (role {role}). Never enable it in production.',
  'login.noProvider': 'The backend offers no login method. Check OIDC_CLIENT_ENABLED and DEV_AUTH_ENABLED.',
  'login.role.admin': 'Administrator',
  'login.role.user': 'User',
  'login.submit': 'Sign in',
  'login.failed': 'Sign in failed',
};
