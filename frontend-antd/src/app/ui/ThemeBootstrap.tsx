import { useEffect } from 'react';

import type { ThemeStore } from '@/features/theme-switch';

import { applyLanguage } from '@/shared/i18n';

export interface ThemeBootstrapProps {
  store: ThemeStore;
}

/**
 * Применяет сохранённую тему до первой отрисовки shell и синхронизирует
 * `<html lang>` с языком интерфейса.
 */
export function ThemeBootstrap({ store }: ThemeBootstrapProps) {
  useEffect(() => {
    applyLanguage();
    store.apply();
  }, [store]);

  return null;
}
