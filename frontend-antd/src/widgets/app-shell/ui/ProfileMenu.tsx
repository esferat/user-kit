import { Avatar, Dropdown } from 'antd';

import type { AuthenticatedUser } from '@/entities/user';

import { useTranslate } from '@/shared/i18n';
import { initialsOf } from '@/shared/lib';
import { ICONS } from '@/shared/ui';

export interface ProfileMenuProps {
  user: AuthenticatedUser;
  onLogout(): void;
}

/** Avatar of the header that opens the account menu with the sign out entry. */
export function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  const t = useTranslate();
  const label = t('shell.profile', { name: user.displayName });

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          { key: 'account', icon: <ICONS.account />, label: user.email ?? user.username, disabled: true },
          { type: 'divider' },
          {
            key: 'logout',
            icon: <ICONS.logout />,
            label: t('shell.logout'),
            onClick: onLogout,
          },
        ],
      }}
    >
      <Avatar
        style={{ cursor: 'pointer', background: '#1677ff' }}
        aria-label={label}
        alt={initialsOf(user.displayName)}
      >
        {initialsOf(user.displayName)}
      </Avatar>
    </Dropdown>
  );
}
