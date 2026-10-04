import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

import { ConfigurationError } from '@/shared/config';
import { i18n } from '@/shared/i18n';

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

function renderBoundary(children: React.ReactNode) {
  return render(<ErrorBoundary>{children}</ErrorBoundary>);
}

beforeEach(() => {
  i18n.setLocale('ru');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('ErrorBoundary', () => {
  it('renders its children while nothing fails', () => {
    const { container } = renderBoundary(<p>application</p>);

    expect(container.querySelector('p')?.textContent).toBe('application');
    expect(container.querySelector('.startup-error')).toBeNull();
  });

  it('shows the reason of a failed render instead of an empty page', () => {
    const { container } = renderBoundary(<Boom message="render failed" />);

    expect(container.querySelector('.startup-title')?.textContent).toBe(i18n.t('app.startFailed'));
    expect(container.querySelector('.startup-message')?.textContent).toBe('render failed');
  });

  it('names a broken configuration', () => {
    const { container } = renderBoundary(<Boom message="Missing OIDC settings" />);

    expect(container.querySelector('.startup-title')?.textContent).toBe(i18n.t('app.startFailed'));
  });

  it('logs the failure with its component stack', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderBoundary(<Boom message="render failed" />);

    expect(log).toHaveBeenCalledWith('The application could not be rendered', expect.any(Error), expect.any(String));
  });

  it('keeps rendering the children after a recovered failure', () => {
    const { container, rerender } = renderBoundary(<p>application</p>);
    rerender(<p>second</p>);

    expect(container.querySelector('p')?.textContent).toBe('second');
  });

  it('reports a configuration error of the boundary itself', () => {
    function Broken(): never {
      throw new ConfigurationError('Missing OIDC settings: VITE_OIDC_AUTHORITY');
    }

    const { container } = renderBoundary(<Broken />);

    expect(container.querySelector('.startup-title')?.textContent).toBe(i18n.t('app.notConfigured'));
    expect(container.querySelector('.startup-message')?.textContent).toBe('Missing OIDC settings: VITE_OIDC_AUTHORITY');
  });
});
