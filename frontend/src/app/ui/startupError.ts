import { t } from '@/shared/i18n';
import { element } from '@/shared/lib';

/**
 * Renders a failure that happened before the shell existed, for example an
 * incomplete configuration. Without this the page stays blank and the reason is
 * only visible in the browser console.
 */
export function renderStartupError(root: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const isConfiguration = error instanceof Error && error.name === 'ConfigurationError';

  const host = element('div', { className: 'startup-error' });
  host.append(
    element('h1', {
      className: 'startup-title',
      text: t(isConfiguration ? 'app.notConfigured' : 'app.startFailed'),
    }),
    element('p', { className: 'startup-message', text: message }),
    element('p', {
      className: 'startup-hint',
      text: t(isConfiguration ? 'app.hint.configuration' : 'app.hint.generic'),
    }),
  );
  root.replaceChildren(host);
}
