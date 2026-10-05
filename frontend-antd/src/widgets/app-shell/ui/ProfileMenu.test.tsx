import { fireEvent, render, waitFor } from '@testing-library/react';
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

function avatar(container: HTMLElement): HTMLElement {
  return container.querySelector('.ant-avatar') as HTMLElement;
}

/** `Dropdown` renders its menu into a portal at the end of the document body. */
function menuItems(): HTMLElement[] {
  return [...document.querySelectorAll('.ant-dropdown-menu-item')] as HTMLElement[];
}

function openMenu(container: HTMLElement): void {
  fireEvent.click(avatar(container));
}

beforeEach(() => {
  i18n.setLocale('ru');
  window.location.hash = '';
});

describe('ProfileMenu', () => {
  it('shows the avatar of the signed in user', () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    expect(avatar(container).textContent).toBe('JD');
    expect(avatar(container).getAttribute('aria-label')).toBe(i18n.t('shell.profile', { name: 'Jane Doe' }));
  });

  it('keeps the menu closed until the avatar is clicked', () => {
    render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    expect(menuItems()).toHaveLength(0);
  });

  it('opens the menu with the account and the sign out entry', async () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    openMenu(container);

    await waitFor(() =>
      expect(menuItems().map((item) => item.textContent)).toEqual([USER.email, i18n.t('shell.logout')]),
    );
  });

  it('signs the user out from the menu', async () => {
    const onLogout = vi.fn();
    const { container } = render(<ProfileMenu user={USER} onLogout={onLogout} />);

    openMenu(container);
    await waitFor(() => expect(menuItems()).toHaveLength(2));
    fireEvent.click(menuItems()[1]);

    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('marks the account entry read only so it cannot be picked', async () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    openMenu(container);

    await waitFor(() => expect(menuItems()[0].classList.contains('ant-dropdown-menu-item-disabled')).toBe(true));
  });

  it('falls back to the username when the account has no email', async () => {
    const { container } = render(<ProfileMenu user={{ ...USER, email: undefined }} onLogout={() => undefined} />);

    openMenu(container);

    await waitFor(() => expect(menuItems()[0].textContent).toBe('jane'));
  });

  it('follows the interface language', async () => {
    const { container } = render(<ProfileMenu user={USER} onLogout={() => undefined} />);

    setLocale('en');
    openMenu(container);

    await waitFor(() => expect(menuItems()[1].textContent).toBe('Sign out'));
    expect(avatar(container).getAttribute('aria-label')).toBe('Profile Jane Doe');
  });
});
