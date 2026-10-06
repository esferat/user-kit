import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

import type { AuthMode, AuthProvider } from '@/features/auth';
import type { AppConfig } from '@/shared/config';

import { AuthSessionProvider, SessionStore } from '@/features/auth';
import { readConfig } from '@/shared/config';
import { i18n } from '@/shared/i18n';

const CONFIG = readConfig({});
const DEV_CONFIG = readConfig({ VITE_DEV_ROLE: 'admin' });

function createAuth(mode: AuthMode = 'oidc', overrides: Partial<AuthProvider> = {}): AuthProvider {
  return {
    mode: vi.fn(async () => mode),
    restore: vi.fn(async () => null),
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    onAuthenticated: () => () => undefined,
    ...overrides,
  };
}

function renderPage(auth: AuthProvider, config: AppConfig = CONFIG) {
  return render(
    <AuthSessionProvider store={new SessionStore(auth)}>
      <LoginPage config={config} />
    </AuthSessionProvider>,
  );
}

function cardTitle(container: HTMLElement): string | undefined {
  return container.querySelector('.ant-card-head-title')?.textContent ?? undefined;
}

function submit(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('.login-card-body button.ant-btn-primary') as HTMLButtonElement;
}

function roleSelect(container: HTMLElement): HTMLElement | null {
  return container.querySelector('.login-card-body .ant-select');
}

function alerts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.ant-alert')].map((strip) => strip.textContent ?? '');
}

async function ready(container: HTMLElement): Promise<void> {
  // Кнопка остаётся занятой, пока backend не ответит, какие способы входа доступны.
  await waitFor(() => expect(submit(container).querySelector('.anticon-loading')).toBeNull());
}

function chooseRole(container: HTMLElement, role: 'admin' | 'user'): void {
  fireEvent.mouseDown(roleSelect(container)?.querySelector('.ant-select-content') as Element);
  const option = [...document.querySelectorAll('.ant-select-item-option')].find(
    (entry) => entry.textContent === i18n.t(`login.role.${role}`),
  );
  if (option) {
    fireEvent.click(option);
  }
}

beforeEach(() => {
  i18n.setLocale('ru');
  window.location.hash = '#/admin-users';
});

describe('LoginPage', () => {
  it('introduces the application and asks for the sign in', () => {
    const { container } = renderPage(createAuth());

    expect(cardTitle(container)).toBe(i18n.t('app.title'));
    expect(container.querySelector('.login-description')?.textContent).toBe(i18n.t('login.description'));
    expect(submit(container).textContent).toBe(i18n.t('login.submit'));
  });

  it('shows no warning when the backend offers a provider login', async () => {
    const { container } = renderPage(createAuth('oidc'));

    await waitFor(() => expect(submit(container).disabled).toBe(false));
    expect(alerts(container)).toEqual([]);
  });

  it('warns about the development authentication and offers the role', async () => {
    const { container } = renderPage(createAuth('dev'), DEV_CONFIG);

    await waitFor(() => expect(roleSelect(container)).not.toBeNull());
    expect(alerts(container)).toEqual([i18n.t('login.devWarning', { role: 'admin' })]);

    fireEvent.mouseDown(roleSelect(container)?.querySelector('.ant-select-content') as Element);
    expect([...document.querySelectorAll('.ant-select-item-option')].map((option) => option.textContent)).toEqual([
      i18n.t('login.role.admin'),
      i18n.t('login.role.user'),
    ]);
  });

  it('reports a backend without any login method', async () => {
    const { container } = renderPage(createAuth('none'));

    await waitFor(() => expect(alerts(container)).toEqual([i18n.t('login.noProvider')]));
    expect(submit(container).disabled).toBe(true);
  });

  it('reports a failed restore of the session', async () => {
    const auth = createAuth('oidc', {
      restore: vi.fn(async () => {
        throw new Error('session expired');
      }),
    });

    const { container } = renderPage(auth);

    await waitFor(() => expect(alerts(container)).toEqual(['session expired']));
  });

  it('signs in with the hash the user tried to open', async () => {
    const auth = createAuth();
    const { container } = renderPage(auth);
    await ready(container);

    fireEvent.click(submit(container));

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith({ returnUrl: '#/admin-users', role: 'user' }));
  });

  it('passes the chosen dev role to the login', async () => {
    const auth = createAuth('dev');
    const { container } = renderPage(auth, DEV_CONFIG);
    await waitFor(() => expect(roleSelect(container)).not.toBeNull());

    chooseRole(container, 'user');
    fireEvent.click(submit(container));

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith({ returnUrl: '#/admin-users', role: 'user' }));
  });

  it('reports a rejected sign in and offers it again', async () => {
    const auth = createAuth('oidc', {
      login: vi.fn(async () => {
        throw new Error('authorization server unreachable');
      }),
    });
    const { container } = renderPage(auth);
    await ready(container);

    fireEvent.click(submit(container));

    await waitFor(() => expect(alerts(container)).toContain('authorization server unreachable'));
    expect(submit(container).querySelector('.anticon-loading')).toBeNull();
  });

  it('keeps the sign in button busy while the provider works', async () => {
    let finish: () => void = () => undefined;
    const auth = createAuth('oidc', {
      login: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    const { container } = renderPage(auth);
    await ready(container);

    fireEvent.click(submit(container));

    expect(submit(container).querySelector('.anticon-loading')).not.toBeNull();

    finish();
  });
});
