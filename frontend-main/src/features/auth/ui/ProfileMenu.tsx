'use client';

import Link from 'next/link';
import {Avatar, Button, Dropdown, Space, Tag, Typography} from 'antd';
import {useEffect, useState} from 'react';

import {initialsOf} from '@/shared/lib';
import {loadProfileAvatar, type RemoteProfileAvatar} from '@/shared/lib';
import {useAuth} from '@/features/auth';

/**
 * Аватар в шапке приходит из микрофронтенда `user-profile` (expose
 * `./ProfileAvatar`): так меню показывает ту же версию изображения, что и
 * страницы профиля. Пока remote грузится или если он недоступен, остаётся
 * локальная плашка на данных сессии — меню не зависит от чужого сервиса.
 */
function HeaderAvatar({name, fallbackUrl}: { name: string; fallbackUrl?: string | null }) {
  const [RemoteAvatar, setRemoteAvatar] = useState<RemoteProfileAvatar | null>(null);

  useEffect(() => {
    let alive = true;

    loadProfileAvatar()
      .then((component) => {
        if (alive) {
          setRemoteAvatar(() => component);
        }
      })
      .catch((e) => console.error(e, 'loadProfileAvatar call failed'));

    return () => {
      alive = false;
    };
  }, []);

  if (RemoteAvatar !== null) {
    return <RemoteAvatar size={24} name={name}/>;
  }

  return (
    <Avatar size="small" src={fallbackUrl ?? undefined}>
      {initialsOf(name)}
    </Avatar>
  );
}

/** Меню профиля: кто вошёл, роли и выход. Без сессии предлагает войти. */
export function ProfileMenu() {
  const auth = useAuth();
  const user = auth.user;

  if (user === null) {
    return (
      <Button type="primary" onClick={() => void auth.login()}>Войти</Button>
    );
  }

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'info',
            disabled: true,
            label: (
              <Space orientation="vertical" size={0}>
                <Typography.Text strong>
                  {user.displayName}
                  <Space size={4}>
                    {user.roles.map((role) => (
                      <Tag key={role} color={role === 'admin' ? 'gold' : 'blue'}>
                        {role}
                      </Tag>
                    ))}
                  </Space>
                </Typography.Text>
                <Typography.Text type="secondary">{user.email}</Typography.Text>
              </Space>
            ),
          },
          {
            key: 'profile',
            label: (
              <Link href={'/profile'} replace>
                Личный кабинет
              </Link>
            )
          },
          {type: 'divider'},
          {key: 'logout', label: 'Выйти', danger: true},
        ],
        onClick: ({key}) => {
          if (key === 'logout') {
            void auth.logout();
          }
        },
      }}
    >
      <Button type="text" style={{color: '#fff', height: 'auto', padding: 4}}>
        <Space>
          <HeaderAvatar name={user.displayName} fallbackUrl={user.avatarThumbnailUrl}/>
          {user.displayName}
        </Space>
      </Button>
    </Dropdown>
  );
}
