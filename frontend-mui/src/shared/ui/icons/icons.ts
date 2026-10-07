import AccountCircle from '@mui/icons-material/AccountCircle';
import DarkMode from '@mui/icons-material/DarkMode';
import Delete from '@mui/icons-material/Delete';
import Download from '@mui/icons-material/Download';
import Folder from '@mui/icons-material/Folder';
import Group from '@mui/icons-material/Group';
import Key from '@mui/icons-material/Key';
import LightMode from '@mui/icons-material/LightMode';
import Logout from '@mui/icons-material/Logout';
import Refresh from '@mui/icons-material/Refresh';
import Upload from '@mui/icons-material/Upload';

/**
 * Компоненты иконок, используемые в приложении.
 *
 * Имена собраны в одном месте специально: `icons.test.tsx` отрисовывает каждую
 * из них и приводит к падению теста, если иконка не создаёт данных пути,
 * вместо отображения пустого прямоугольника в интерфейсе.
 */
export const ICONS = {
  documents: Folder,
  users: Group,
  account: AccountCircle,
  lightTheme: LightMode,
  darkTheme: DarkMode,
  login: Key,
  logout: Logout,
  upload: Upload,
  download: Download,
  refresh: Refresh,
  delete: Delete,
} as const;

export type IconName = keyof typeof ICONS;

/** Компонент из записи {@link ICONS}, который можно отрендерить как `<entry.icon />`. */
export type IconComponent = (typeof ICONS)[IconName];
