import { AppProviders } from '@shared/ui';

import { ProfileEditForm, type ProfileEditFormProps } from './ui/ProfileEditForm';

export { ProfileEditForm };
export type { ProfileEditFormProps };

/**
 * Точка входа микрофронтенда: именно этот модуль публикуется в
 * `module-federation.config.ts` под именем `./ProfileEdit`.
 *
 * Компонент самодостаточен — он привозит свои провайдеры (QueryClient, antd),
 * потому что рендерится внутри чужого приложения и не может рассчитывать на
 * контексты хоста.
 */
export default function ProfileEditEntry(props: ProfileEditFormProps) {
  return (
    <AppProviders>
      <ProfileEditForm {...props} />
    </AppProviders>
  );
}
