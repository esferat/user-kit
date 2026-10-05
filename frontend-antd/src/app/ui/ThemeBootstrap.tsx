import { useEffect } from 'react';

import type { ThemeStore } from '@/features/theme-switch';

import { applyLanguage } from '@/shared/i18n';

export interface ThemeBootstrapProps {
  store: ThemeStore;
}

/**
 * Applies the stored theme before the first paint of the shell and keeps
 * `<html lang>` in sync with the interface language.
 */
export function ThemeBootstrap({ store }: ThemeBootstrapProps) {
  useEffect(() => {
    applyLanguage();
    store.apply();
  }, [store]);

  return null;
}
