import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

import type { AuthProvider } from '@/features/auth';
import type { AppConfig } from '@/shared/config';

import { AuthSessionProvider } from '@/features/auth';
import { readConfig } from '@/shared/config';
import { i18n } from '@/shared/i18n';

const OIDC_CONFIG = readConfig({
  VITE_AUTH_MODE: 'oidc',
  VITE_OIDC_AUTHORITY: 'https://idp.user-kit.local/realms/main',
  VITE_OIDC_REDIRECT_URI: 'http://localhost:5173/',
});

const DEV_CONFIG = readConfig({ VITE_AUTH_MODE: 'dev', VITE_DEV_ROLE: 'admin' });

function createAuth(overrides: Partial<AuthProvider> = {}): AuthProvider {
  return {
    kind: 'oidc',
    restore: vi.fn(async () => null),
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    getAccessToken: vi.fn(async () => null),
    onAuthenticated: () => () => undefined,
    ...overrides,
  };
}

function renderPage(auth: AuthProvider, config: AppConfig = OIDC_CONFIG) {
  return render(
    <AuthSessionProvider auth={auth}>
      <LoginPage config={config} />
    </AuthSessionProvider>,
  );
}

function submit(container: HTMLElement): HTMLElement {
  return container.querySelector('.login-card-body ui5-button') as HTMLElement;
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

  it('shows no warning for a configured OIDC authority', () => {
    const { container } = renderPage(createAuth());

    expect(strips(container)).toEqual([]);
  });

  it('warns about the development authentication', () => {
    const { container } = renderPage(createAuth({ kind: 'dev' }), DEV_CONFIG);

    expect(strips(container)).toEqual([i18n.t('login.devWarning', { role: 'admin' })]);
  });

  it('reports a missing OIDC authority', () => {
    const config = readConfig({ VITE_AUTH_MODE: 'oidc', VITE_OIDC_REDIRECT_URI: 'http://localhost:5173/' });

    const { container } = renderPage(createAuth(), config);

    expect(strips(container)).toEqual([i18n.t('login.missingAuthority')]);
  });

  it('reports a failed restore of the session', async () => {
    const auth = createAuth({
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

    fireEvent.click(submit(container));

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('#/admin-users'));
  });

  it('reports a rejected sign in and offers it again', async () => {
    const auth = createAuth({
      login: vi.fn(async () => {
        throw new Error('authorization server unreachable');
      }),
    });
    const { container } = renderPage(auth);

    fireEvent.click(submit(container));

    await waitFor(() => expect(strips(container)).toContain('authorization server unreachable'));
    expect((submit(container) as HTMLElement & { loading: boolean }).loading).toBe(false);
  });

  it('keeps the sign in button busy while the provider works', () => {
    let finish: () => void = () => undefined;
    const auth = createAuth({
      login: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    const { container } = renderPage(auth);

    fireEvent.click(submit(container));

    expect((submit(container) as HTMLElement & { loading: boolean }).loading).toBe(true);

    finish();
  });
});
