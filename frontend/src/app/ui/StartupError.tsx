import { useTranslate } from '@/shared/i18n';

export interface StartupErrorProps {
  error: unknown;
}

/**
 * Рендерит сбой, который произошёл до запуска shell, — например, неполную
 * конфигурацию. Без этого страница остаётся пустой, а причина видна только в
 * консоли браузера.
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
