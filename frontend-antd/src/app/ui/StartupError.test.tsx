import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { StartupError } from './StartupError';

import { ConfigurationError } from '@/shared/config';
import { i18n } from '@/shared/i18n';

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('StartupError', () => {
  it('reports a broken configuration with its own title and hint', () => {
    const { container } = render(<StartupError error={new ConfigurationError('Missing OIDC settings')} />);

    expect(container.querySelector('.startup-title')?.textContent).toBe(i18n.t('app.notConfigured'));
    expect(container.querySelector('.startup-message')?.textContent).toBe('Missing OIDC settings');
    expect(container.querySelector('.startup-hint')?.textContent).toBe(i18n.t('app.hint.configuration'));
  });

  it('reports any other failure of the start', () => {
    const { container } = render(<StartupError error={new Error('Root element #app not found')} />);

    expect(container.querySelector('.startup-title')?.textContent).toBe(i18n.t('app.startFailed'));
    expect(container.querySelector('.startup-message')?.textContent).toBe('Root element #app not found');
    expect(container.querySelector('.startup-hint')?.textContent).toBe(i18n.t('app.hint.generic'));
  });

  it('renders a thrown value that is no error', () => {
    const { container } = render(<StartupError error="no container" />);

    expect(container.querySelector('.startup-message')?.textContent).toBe('no container');
    expect(container.querySelector('.startup-title')?.textContent).toBe(i18n.t('app.startFailed'));
  });
});
