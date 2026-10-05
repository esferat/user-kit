import { Avatar } from '@ui5/webcomponents-react/Avatar';
import { Menu } from '@ui5/webcomponents-react/Menu';
import { MenuItem } from '@ui5/webcomponents-react/MenuItem';
import { useState } from 'react';

import type { AuthenticatedUser } from '@/entities/user';

import { useTranslate } from '@/shared/i18n';
import { initialsOf } from '@/shared/lib';
import { ICONS } from '@/shared/ui';

export interface ProfileMenuProps {
  user: AuthenticatedUser;
  onLogout(): void;
}

/** Avatar of the shell bar that opens the account menu with the sign out entry. */
export function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState<HTMLElement | null>(null);

  return (
    <>
      <Avatar
        slot="profile"
        initials={initialsOf(user.displayName)}
        interactive
        accessibleName={t('shell.profile', { name: user.displayName })}
        ref={setAvatar}
        onClick={() => {
          setOpen((isOpen) => !isOpen);
        }}
      />
      <Menu
        slot="profile"
        placement="Bottom"
        open={open}
        opener={avatar ?? undefined}
        onClose={() => {
          setOpen(false);
        }}
      >
        <MenuItem icon={ICONS.account} text={user.email ?? user.username} />
        <MenuItem
          icon={ICONS.logout}
          text={t('shell.logout')}
          onClick={() => {
            setOpen(false);
            onLogout();
          }}
        />
      </Menu>
    </>
  );
}
