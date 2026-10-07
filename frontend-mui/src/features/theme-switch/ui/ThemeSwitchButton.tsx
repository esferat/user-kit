import { IconButton } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';

import { DARK_THEME, selectTheme, toggleTheme } from '../model/themeSlice';

import { useTranslate } from '@/shared/i18n';
import { ICONS } from '@/shared/ui';

/** Кнопка в шапке, переключающая между светлой и тёмной темой Material UI. */
export function ThemeSwitchButton() {
  const t = useTranslate();
  const dispatch = useDispatch();
  const dark = useSelector(selectTheme).theme === DARK_THEME;
  const label = t(dark ? 'shell.theme.light' : 'shell.theme.dark');

  return (
    <IconButton
      color="inherit"
      aria-label={label}
      title={label}
      onClick={() => {
        dispatch(toggleTheme());
      }}
    >
      {dark ? <ICONS.lightTheme /> : <ICONS.darkTheme />}
    </IconButton>
  );
}
