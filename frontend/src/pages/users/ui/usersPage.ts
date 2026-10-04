import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Title.js';
import '@ui5/webcomponents/dist/Toolbar.js';
import '@ui5/webcomponents/dist/ToolbarSpacer.js';
import '@ui5/webcomponents-fiori/dist/Page.js';

import type Button from '@ui5/webcomponents/dist/Button.js';

import { roleLabel, type Role, type UserApi, type UserDto } from '@/entities/user';
import { t } from '@/shared/i18n';
import { element, messageOfError, showMessage } from '@/shared/lib';
import { ICONS } from '@/shared/ui';
import { createUsersTable } from '@/widgets/users-table';

export interface UsersPageOptions {
  userApi: UserApi;
}

/** Administration page: all users with the inline role assignment. */
export function createUsersPage(options: UsersPageOptions): HTMLElement {
  const { userApi } = options;
  const page = element('ui5-page');
  const pageHeader = element('header', { attributes: { slot: 'header' } });
  pageHeader.classList.add('page-header');
  const pageContent = element('div', { className: 'page-content' });

  const title = document.createElement('ui5-title');
  title.textContent = t('users.title');

  const refreshButton = document.createElement('ui5-button') as Button;
  refreshButton.icon = ICONS.refresh;
  refreshButton.tooltip = t('users.refresh');
  refreshButton.accessibleName = t('users.refresh');
  refreshButton.iconOnly = true;

  const toolbar = element('ui5-toolbar');
  const toolbarSpacer = document.createElement('ui5-toolbar-spacer');
  toolbar.append(title, toolbarSpacer, refreshButton);
  pageHeader.append(toolbar);
  page.append(pageHeader, pageContent);

  const messageHost = element('div', { className: 'message-host' });

  const table = createUsersTable({
    onRoleChange: (user, role) => {
      void updateRoles(user, role);
    },
  });

  async function updateRoles(user: UserDto, role: Role): Promise<void> {
    try {
      await userApi.updateRoles(user.id, [role]);
      showMessage(messageHost, t('users.message.roleUpdated', { email: user.email, role: roleLabel(role) }), 'Success');
      await load();
    } catch (error) {
      showMessage(messageHost, messageOfError(error, t('common.unknownError')), 'Error');
      await load();
    }
  }

  async function load(): Promise<void> {
    table.setLoading(true);
    try {
      const response = await userApi.list({ orderBy: [{ property: 'email' }], top: 100, count: true });
      table.setUsers(response.value);
      messageHost.replaceChildren();
    } catch (error) {
      showMessage(messageHost, messageOfError(error, t('common.unknownError')), 'Error');
    } finally {
      table.setLoading(false);
    }
  }

  refreshButton.addEventListener('click', () => {
    void load();
  });

  pageContent.append(messageHost, table.element);

  void load();

  return page;
}
