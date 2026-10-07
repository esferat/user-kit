import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { useMemo, type ReactNode } from 'react';

import { useAppSelector } from '../model/hooks';

import { DARK_THEME } from '@/features/theme-switch';

function modularPalette(mode: 'light' | 'dark') {
  return createTheme({ palette: { mode }, shape: { borderRadius: 6 } });
}

/**
 * Оборачивает приложение в тему Material UI. Провайдер читает тему из store,
 * обязательно — выше экрана входа, потому что тот тоже рендерит компоненты
 * Material UI.
 */
export interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const dark = useAppSelector((state) => state.theme.theme === DARK_THEME);
  const muiTheme = useMemo(() => modularPalette(dark ? 'dark' : 'light'), [dark]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
