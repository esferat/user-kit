import { Helmet } from '@modern-js/runtime/head';

import { ProfileShell } from '@widgets/profile-shell';

/** Локальный роут правки профиля этого сервиса. */
export default function ProfileEditPage() {
  return (
    <>
      <Helmet>
        <title>Правка профиля — user-profile</title>
      </Helmet>
      <ProfileShell />
    </>
  );
}
