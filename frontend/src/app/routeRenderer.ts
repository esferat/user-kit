import '@ui5/webcomponents/dist/MessageStrip.js';

import type { FileApi } from '@/entities/file';
import type { UserApi } from '@/entities/user';

import { createDocumentsPage } from '@/pages/documents';
import { renderLoginPage } from '@/pages/login';
import { createUsersPage } from '@/pages/users';

export interface RouteContext {
  fileApi: FileApi;
  userApi: UserApi;
}

export interface PageRenderer {
  /** Creates every page the shell may route to. */
  create(fileApi: FileApi, userApi: UserApi): RouteContext;
  render(routeId: string, context: RouteContext): HTMLElement;
}

/** Page per route id; the administration page is only reachable with the admin role. */
export function createPageRenderer(): PageRenderer {
  return {
    create: (fileApi, userApi) => ({ fileApi, userApi }),
    render: (routeId, context) =>
      routeId === 'admin-users'
        ? createUsersPage({ userApi: context.userApi })
        : createDocumentsPage({ fileApi: context.fileApi }),
  };
}

/** Message strip shown above the login screen after a failed session restore. */
export function prependLoginMessage(root: HTMLElement, message: string): void {
  const strip = document.createElement('ui5-message-strip');
  strip.setAttribute('design', 'Negative');
  strip.textContent = message;
  root.prepend(strip);
}

export type { LoginPageOptions } from '@/pages/login';
export { renderLoginPage };
