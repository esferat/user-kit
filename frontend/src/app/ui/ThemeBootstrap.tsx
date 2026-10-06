import { useEffect } from 'react';

import type { ThemeStore } from '@/features/theme-switch';

import { applyLanguage } from '@/shared/i18n';

export interface ThemeBootstrapProps {
  store: ThemeStore;
}

/**
 * Применяет сохранённую тему UI5 до первой отрисовки shell и синхронизирует
 * `<html lang>` с языком интерфейса.
 */
export function ThemeBootstrap({ store }: ThemeBootstrapProps) {
  useEffect(() => {
    applyLanguage();
    void store.apply();
  }, [store]);

  return null;
}
