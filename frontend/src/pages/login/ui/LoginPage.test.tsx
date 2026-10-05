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

function submit(container: HTMLElement): HTMLElement {
  return container.querySelector('.login-card-body ui5-button') as HTMLElement;
}

async function ready(container: HTMLElement): Promise<void> {
  // The button stays busy until the backend has answered which login exists.
  await waitFor(() => expect((submit(container) as HTMLElement & { loading: boolean }).loading).toBe(false));
}

function strips(container: HTMLElement): string[] {
  return [...container.querySelectorAll('ui5-message-strip')].map((strip) => strip.textContent ?? '');
}

beforeEach(() => {
  i18n.setLocale('ru');
  window.location.hash = '#/admin-users';
});

describe('LoginPage', () => {
  it('introduces the application and asks for the sign in', () => {
    const { container } = renderPage(createAuth());

    expect(container.querySelector('ui5-card-header')?.getAttribute('title-text')).toBe(i18n.t('app.title'));
    expect(container.querySelector('ui5-card-header')?.getAttribute('subtitle-text')).toBe(i18n.t('login.subtitle'));
    expect(container.querySelector('.login-card-body ui5-text')?.textContent).toBe(i18n.t('login.description'));
    expect(submit(container).textContent).toBe(i18n.t('login.submit'));
  });

  it('shows no warning when the backend offers a provider login', async () => {
    const { container } = renderPage(createAuth('oidc'));

    await waitFor(() => expect(submit(container).hasAttribute('disabled')).toBe(false));
    expect(strips(container)).toEqual([]);
  });

  it('warns about the development authentication and offers the role', async () => {
    const { container } = renderPage(createAuth('dev'), DEV_CONFIG);

    await waitFor(() => expect(container.querySelector('.login-card-body ui5-select')).not.toBeNull());
    expect(strips(container)).toEqual([i18n.t('login.devWarning', { role: 'admin' })]);
    expect(container.querySelectorAll('.login-card-body ui5-option')).toHaveLength(2);
  });

  it('reports a backend without any login method', async () => {
    const { container } = renderPage(createAuth('none'));

    await waitFor(() => expect(strips(container)).toEqual([i18n.t('login.noProvider')]));
    expect(submit(container).hasAttribute('disabled')).toBe(true);
  });

  it('reports a failed restore of the session', async () => {
    const auth = createAuth('oidc', {
      restore: vi.fn(async () => {
        throw new Error('session expired');
      }),
    });

    const { container } = renderPage(auth);

    await waitFor(() => expect(strips(container)).toEqual(['session expired']));
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
    await waitFor(() => expect(container.querySelector('.login-card-body ui5-select')).not.toBeNull());
    await ready(container);

    fireEvent.change(container.querySelector('ui5-select') as HTMLElement, { target: { value: 'admin' } });
    fireEvent.click(submit(container));

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith({ returnUrl: '#/admin-users', role: 'admin' }));
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

    await waitFor(() => expect(strips(container)).toContain('authorization server unreachable'));
    expect((submit(container) as HTMLElement & { loading: boolean }).loading).toBe(false);
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

    expect((submit(container) as HTMLElement & { loading: boolean }).loading).toBe(true);

    finish();
  });
});
