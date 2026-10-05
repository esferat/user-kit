import { Page } from '@ui5/webcomponents-react/Page';
import { Title } from '@ui5/webcomponents-react/Title';
import { Toolbar } from '@ui5/webcomponents-react/Toolbar';
import { ToolbarButton } from '@ui5/webcomponents-react/ToolbarButton';
import { ToolbarItem } from '@ui5/webcomponents-react/ToolbarItem';
import { ToolbarSpacer } from '@ui5/webcomponents-react/ToolbarSpacer';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import type { UsersStore } from '../model/usersStore';

import type { Role, UserDto } from '@/entities/user';

import { useTranslate } from '@/shared/i18n';
import { ICONS, Message } from '@/shared/ui';
import { UsersTable } from '@/widgets/users-table';

export interface UsersPageProps {
  store: UsersStore;
}

function UsersPageView({ store }: UsersPageProps) {
  const t = useTranslate();

  useEffect(() => store.start(), [store]);

  function onRoleChange(user: UserDto, role: Role): void {
    void store.updateRoles(user, role);
  }

  return (
    <Page>
      <header className="page-header" slot="header">
        <Toolbar>
          <ToolbarItem>
            <Title>{t('users.title')}</Title>
          </ToolbarItem>
          <ToolbarSpacer />
          <ToolbarButton
            icon={ICONS.refresh}
            tooltip={t('users.refresh')}
            accessibleName={t('users.refresh')}
            onClick={() => {
              void store.refresh();
            }}
          />
        </Toolbar>
      </header>
      <div className="page-content">
        <div className="message-host">
          {store.message !== undefined && <Message text={store.message.text} design={store.message.design} />}
        </div>
        <UsersTable users={store.users} loading={store.loading} onRoleChange={onRoleChange} />
      </div>
    </Page>
  );
}

/** Administration page: all users with the inline role assignment. */
export const UsersPage = observer(UsersPageView);
