import { useEffect } from 'react';

import { useAppDispatch } from '../model/hooks';

import { commitTheme } from '@/features/theme-switch';
import { applyLanguage } from '@/shared/i18n';

/**
 * Применяет сохранённую тему до первой отрисовки shell и синхронизирует
 * `<html lang>` с языком интерфейса.
 */
export function ThemeBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    applyLanguage();
    dispatch(commitTheme());
  }, [dispatch]);

  return null;
}
