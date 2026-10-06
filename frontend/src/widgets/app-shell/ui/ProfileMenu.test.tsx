import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileMenu } from './ProfileMenu';

import type { AuthenticatedUser } from '@/entities/user';

import { i18n, setLocale } from '@/shared/i18n';

const USER: AuthenticatedUser = {
  subject: 'oidc-1',
  username: 'jane',
  displayName: 'Jane Doe',
  email: 'jane@user-kit.local',
  roles: ['admin'],
};

function avatar(container: HTMLElement): HTMLElement & { initials: string; interactive: boolean } {
  return container.querySelector('ui5-avatar') as HTMLElement & { initials: string; interactive: boolean };
}

/** `ui5-menu` — это сам popover; обёртка в `ui5-popover` скрыла бы пункты. */
function menu(container: HTMLElement): HTMLElement & { open: boolean } {
  return container.querySelector('ui5-menu') as HTMLElement & { open: boolean };
}

function menuItems(container: HTMLElement): (HTMLElement & { text: string })[] {
  return [...container.querySelectorAll('ui5-menu-item')] as (HTMLElement & { text: string })[];
}

beforeEach(() => {
  i18n.setLocale('ru');
  window.location.hash = '';
});

describe('ProfileMenu', () => {
  it('shows the avatar of the signed in user', () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    expect(avatar(container).initials).toBe('JD');
    expect(avatar(container).interactive).toBe(true);
    expect(avatar(container).getAttribute('accessible-name')).toBe(i18n.t('shell.profile', { name: 'Jane Doe' }));
  });

  it('keeps the account and the sign out entry in the menu', () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    expect(menuItems(container).map((item) => item.text)).toEqual([USER.email, i18n.t('shell.logout')]);
  });

  it('opens the menu on the avatar and closes it again', () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);
    expect(menu(container).open).toBe(false);

    fireEvent.click(avatar(container));
    expect(menu(container).open).toBe(true);

    fireEvent.click(avatar(container));
    expect(menu(container).open).toBe(false);
  });

  it('signs the user out from the menu', () => {
    const onLogout = vi.fn();
    const { container } = render(<ProfileMenu user={USER} onLogout={onLogout} />);

    fireEvent.click(avatar(container));
    fireEvent.click(menuItems(container)[1]);

    expect(onLogout).toHaveBeenCalledOnce();
    expect(menu(container).open).toBe(false);
  });

  it('opens the menu as its own popover instead of wrapping it in a popover', () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    expect(container.querySelector('ui5-popover')).toBeNull();
    expect(menu(container).getAttribute('slot')).toBe('profile');
  });

  it('falls back to the username when the account has no email', () => {
    const { container } = render(<ProfileMenu user={{ ...USER, email: undefined }} onLogout={() => undefined} />);

    expect(menuItems(container)[0].text).toBe('jane');
  });

  it('follows the interface language', () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    act(() => {
      setLocale('en');
    });

    expect(menuItems(container)[1].text).toBe('Sign out');
    expect(avatar(container).getAttribute('accessible-name')).toBe('Profile Jane Doe');
  });
});
