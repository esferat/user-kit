import { useTranslate } from '@/shared/i18n';

export interface StartupErrorProps {
  error: unknown;
}

/**
 * Renders a failure that happened before the shell could start, for example an
 * incomplete configuration. Without this the page stays blank and the reason is
 * only visible in the browser console.
 */
export function StartupError({ error }: StartupErrorProps) {
  const t = useTranslate();
  const message = error instanceof Error ? error.message : String(error);
  const isConfiguration = error instanceof Error && error.name === 'ConfigurationError';

  return (
    <div className="startup-error">
      <h1 className="startup-title">{t(isConfiguration ? 'app.notConfigured' : 'app.startFailed')}</h1>
      <p className="startup-message">{message}</p>
      <p className="startup-hint">{t(isConfiguration ? 'app.hint.configuration' : 'app.hint.generic')}</p>
    </div>
  );
}
