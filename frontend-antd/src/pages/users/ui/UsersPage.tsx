import { Button, Space } from 'antd';
import { useEffect, useState } from 'react';

import type { Role, UserApi, UserDto } from '@/entities/user';

import { roleLabel } from '@/entities/user';
import { useTranslate } from '@/shared/i18n';
import { messageOfError, useAsyncTask, type AppMessage } from '@/shared/lib';
import { ICONS, Message } from '@/shared/ui';
import { UsersTable } from '@/widgets/users-table';

export interface UsersPageProps {
  userApi: UserApi;
}

/** Administration page: all users with the inline role assignment. */
export function UsersPage({ userApi }: UsersPageProps) {
  const t = useTranslate();
  const [message, setMessage] = useState<AppMessage | undefined>(undefined);

  const list = useAsyncTask(() => userApi.list({ orderBy: [{ property: 'email' }], top: 100, count: true }));
  const { data, error, loading, run } = list;

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    if (error !== undefined) {
      setMessage({ text: messageOfError(error, t('common.unknownError')), design: 'Error' });
    }
  }, [error, t]);

  async function updateRoles(user: UserDto, role: Role): Promise<void> {
    try {
      await userApi.updateRoles(user.id, [role]);
      setMessage({
        text: t('users.message.roleUpdated', { email: user.email, role: roleLabel(role) }),
        design: 'Success',
      });
      await run();
    } catch (reason) {
      setMessage({ text: messageOfError(reason, t('common.unknownError')), design: 'Error' });
      await run();
    }
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
              loading={loading}
              onClick={() => {
                setMessage(undefined);
                void run();
              }}
            />
          </Space>
        </div>
      </div>
      <div className="page-content">
        <div className="message-host">
          {message !== undefined && <Message text={message.text} design={message.design} />}
        </div>
        <UsersTable
          users={data?.value ?? []}
          loading={loading}
          onRoleChange={(user, role) => {
            void updateRoles(user, role);
          }}
        />
      </div>
    </div>
  );
}
