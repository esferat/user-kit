import {
  DeleteOutlined,
  DownloadOutlined,
  FolderOutlined,
  KeyOutlined,
  LogoutOutlined,
  MoonOutlined,
  ReloadOutlined,
  SunOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';

/**
 * Компоненты иконок, используемые в приложении.
 *
 * Имена собраны в одном месте специально: `icons.test.tsx` отрисовывает каждую
 * из них и приводит к падению теста, если иконка не создаёт данных пути,
 * вместо отображения пустого прямоугольника в интерфейсе.
 */
export const ICONS = {
  documents: FolderOutlined,
  users: TeamOutlined,
  account: UserOutlined,
  lightTheme: SunOutlined,
  darkTheme: MoonOutlined,
  login: KeyOutlined,
  logout: LogoutOutlined,
  upload: UploadOutlined,
  download: DownloadOutlined,
  refresh: ReloadOutlined,
  delete: DeleteOutlined,
} as const;

export type IconName = keyof typeof ICONS;

/** Компонент из записи {@link ICONS}, который можно отрендерить как `<entry.icon />`. */
export type IconComponent = (typeof ICONS)[IconName];
