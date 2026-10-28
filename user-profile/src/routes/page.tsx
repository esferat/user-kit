import { Helmet } from '@modern-js/runtime/head';
import { useNavigate } from '@modern-js/runtime/router';

import { ProfileView } from '@features/profile-view';

/**
 * Домашняя страница сервиса. Содержимое — та же фича `profile-view`, что
 * публикуется в Module Federation для frontend-main, здесь она получает
 * переход к правке от роутера этого приложения.
 */
export default function Index() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Личный кабинет — user-profile</title>
      </Helmet>
      <ProfileView onEdit={() => navigate('/profile/edit')} />
    </>
  );
}
