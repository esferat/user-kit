import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { selectUsers, refreshUsers, updateUserRole } from '../model/usersSlice';

import type { Role, UserDto } from '@/entities/user';
import type { AppDispatch } from '@/shared/lib';

import { useTranslate } from '@/shared/i18n';
import { ICONS, Message } from '@/shared/ui';
import { UsersTable } from '@/widgets/users-table';

/** Страница администрирования: все пользователи с назначением ролей прямо в таблице. */
export function UsersPage() {
  const t = useTranslate();
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector(selectUsers);

  useEffect(() => {
    void dispatch(refreshUsers());
  }, [dispatch]);

  function onRoleChange(user: UserDto, role: Role): void {
    void dispatch(updateUserRole({ user, role }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('users.title')}</h1>
        <div className="page-toolbar">
          <div className="page-toolbar-actions">
            <Tooltip title={t('users.refresh')}>
              <IconButton
                aria-label={t('users.refresh')}
                onClick={() => {
                  void dispatch(refreshUsers());
                }}
              >
                {state.loading ? <CircularProgress className="refresh-spin" size={20} /> : <ICONS.refresh />}
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="page-content">
        <div className="message-host">
          {state.message !== undefined && <Message text={state.message.text} design={state.message.design} />}
        </div>
        <UsersTable users={state.users} loading={state.loading} onRoleChange={onRoleChange} />
      </div>
    </div>
  );
}
