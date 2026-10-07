import { Avatar, Divider, IconButton, ListItemIcon, Menu, MenuItem } from '@mui/material';
import { useState, type MouseEvent } from 'react';

import type { AuthenticatedUser } from '@/entities/user';

import { useTranslate } from '@/shared/i18n';
import { initialsOf } from '@/shared/lib';
import { ICONS } from '@/shared/ui';

export interface ProfileMenuProps {
  user: AuthenticatedUser;
  onLogout(): void;
}

/** Аватар шапки, открывающий меню аккаунта с пунктом выхода. */
export function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  const t = useTranslate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const label = t('shell.profile', { name: user.displayName });

  return (
    <>
      <IconButton
        className="profile-avatar"
        aria-label={label}
        onClick={(event: MouseEvent<HTMLElement>) => {
          setAnchor(event.currentTarget);
        }}
      >
        <Avatar
          alt={initialsOf(user.displayName)}
          sx={{ width: 2, height: 2, bgcolor: 'primary.main', fontSize: '0.75rem' }}
        >
          {initialsOf(user.displayName)}
        </Avatar>
      </IconButton>
      <Menu
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem className="profile-account" disabled>
          <ListItemIcon>
            <ICONS.account fontSize="small" />
          </ListItemIcon>
          {user.email ?? user.username}
        </MenuItem>
        <Divider />
        <MenuItem
          className="profile-logout"
          onClick={() => {
            setAnchor(null);
            onLogout();
          }}
        >
          <ListItemIcon>
            <ICONS.logout fontSize="small" />
          </ListItemIcon>
          {t('shell.logout')}
        </MenuItem>
      </Menu>
    </>
  );
}
