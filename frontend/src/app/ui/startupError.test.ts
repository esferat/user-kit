import { beforeEach, describe, expect, it } from 'vitest';

import { renderStartupError } from './startupError';

import { i18n } from '@/shared/i18n';

function render(error: unknown): HTMLElement {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  renderStartupError(root, error);
  return root;
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('renderStartupError', () => {
  it('names the configuration problem and hints at the missing variables', () => {
    const error = new Error('Missing OIDC settings: VITE_OIDC_AUTHORITY');
    error.name = 'ConfigurationError';

    const root = render(error);

    expect(root.textContent).toContain('Приложение не настроено');
    expect(root.textContent).toContain('VITE_OIDC_AUTHORITY');
    expect(root.textContent).toContain('VITE_AUTH_MODE=dev');
  });

  it('falls back to a generic hint for other failures', () => {
    const root = render(new TypeError('Failed to fetch'));

    expect(root.textContent).toContain('Приложение не удалось запустить');
    expect(root.textContent).toContain('Failed to fetch');
    expect(root.textContent).not.toContain('VITE_AUTH_MODE');
  });

  it('accepts values that are not Error instances', () => {
    const root = render('boom');

    expect(root.textContent).toContain('Приложение не удалось запустить');
    expect(root.textContent).toContain('boom');
  });

  it('follows the active locale', () => {
    i18n.setLocale('en');

    expect(render('boom').textContent).toContain('The application failed to start');
  });

  it('replaces previous content', () => {
    const root = document.createElement('div');
    root.append(document.createElement('span'));
    document.body.replaceChildren(root);

    renderStartupError(root, new Error('boom'));

    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild?.className).toBe('startup-error');
  });
});
