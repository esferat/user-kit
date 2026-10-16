'use client';

import { useEffect, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { Alert, Button, Card, Select, Typography } from 'antd';

import { DEFAULT_ROLE, ROLES, type Role } from '@/entities/user';

import { useAuth } from '../model/useAuth';

const { Title, Paragraph } = Typography;

/**
 * Экран входа. Показывает только те способы входа, которые назвал бэкенд:
 * кнопку OIDC, выбор роли для dev-профиля или сообщение, что вход отключён.
 */
export function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role>(DEFAULT_ROLE);
  const authError = params.get('authError') === '1';

  useEffect(() => {
    if (auth.status === 'authenticated') {
      router.replace('/');
    }
  }, [auth.status, router]);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <Card style={{ width: 380 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          User Kit
        </Title>
        <Paragraph type="secondary">Войдите, чтобы продолжить</Paragraph>

        {authError && (
          <Alert
            type="error"
            showIcon
            message="Не удалось завершить вход"
            description="Провайдер вернул ошибку. Попробуйте ещё раз."
            style={{ marginBottom: 16 }}
          />
        )}

        {auth.failure && (
          <Alert type="error" showIcon message={auth.failure} style={{ marginBottom: 16 }} />
        )}

        {auth.status === 'restoring' && <Paragraph>Проверяем сессию…</Paragraph>}

        {auth.status !== 'restoring' && auth.mode === null && (
          <Paragraph type="secondary">Определяем доступные способы входа…</Paragraph>
        )}

        {auth.mode === 'none' && (
          <Alert
            type="warning"
            showIcon
            message="Вход отключён на сервере"
            description="Обратитесь к администратору."
          />
        )}

        {auth.mode === 'dev' && (
          <div>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              Локальный вход (dev-профиль)
            </Paragraph>
            <Select
              style={{ width: '100%', marginBottom: 16 }}
              value={role}
              onChange={(value: Role) => setRole(value)}
              options={ROLES.map((item) => ({ value: item, label: item }))}
            />
            <Button
              type="primary"
              block
              size="large"
              loading={auth.pending}
              onClick={() => void auth.login(role)}
            >
              Войти
            </Button>
          </div>
        )}

        {auth.mode === 'oidc' && (
          <Button type="primary" block size="large" loading={auth.pending} onClick={() => void auth.login()}>
            Войти
          </Button>
        )}
      </Card>
    </div>
  );
}
