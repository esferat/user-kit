import { Button, Space } from 'antd';
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
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('users.title')}</h1>
        <div className="page-toolbar">
          <Space>
            <Button
              aria-label={t('users.refresh')}
              title={t('users.refresh')}
              icon={<ICONS.refresh />}
              loading={store.loading}
              onClick={() => {
                void store.refresh();
              }}
            />
          </Space>
        </div>
      </div>
      <div className="page-content">
        <div className="message-host">
          {store.message !== undefined && <Message text={store.message.text} design={store.message.design} />}
        </div>
        <UsersTable users={store.users} loading={store.loading} onRoleChange={onRoleChange} />
      </div>
    </div>
  );
}

/** Страница администрирования: все пользователи с назначением ролей прямо в таблице. */
export const UsersPage = observer(UsersPageView);
