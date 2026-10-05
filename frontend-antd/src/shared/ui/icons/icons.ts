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
 * Icon components used by the application.
 *
 * The names live in one place on purpose: `icons.test.ts` renders every one of
 * them and fails the test run on an icon that produces no path data, instead of
 * leaving an empty box in the interface.
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

/** Component of the entry of {@link ICONS}, renderable as `<entry.icon />`. */
export type IconComponent = (typeof ICONS)[IconName];
