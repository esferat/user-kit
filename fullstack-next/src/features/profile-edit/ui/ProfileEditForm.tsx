'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Avatar, Button, Card, Form, Input, Space, Typography, Upload } from 'antd';

import type { AuthenticatedUser } from '@/entities/user';
import { appConfig } from '@/shared/config';
import { initialsOf, messageOfError } from '@/shared/lib';
import { createProfileApi, type ProfileDetails } from '../api/profileApi';

/** Предел загрузки аватара; бэкенд отклонит больший файл с причиной. */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export interface ProfileEditFormProps {
  user: AuthenticatedUser;
  /**
   * Вызывается после успешного сохранения. Экран сам решает, что дальше:
   * обновить сессию, показать уведомление и вернуться к карточке профиля.
   */
  onSaved(): Promise<void>;
}

/**
 * Форма правки базовых данных и аватара. Аватар уходит на бэкенд как есть,
 * уменьшение и две версии (для профиля и для меню) — задача сервера.
 */
export function ProfileEditForm({ user, onSaved }: ProfileEditFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ProfileDetails>();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  const api = useMemo(() => createProfileApi({ baseUrl: appConfig.apiBaseUrl }), []);
  const previewUrl = useMemo(
    () => (avatarFile === null ? null : URL.createObjectURL(avatarFile)),
    [avatarFile],
  );

  useEffect(
    () => () => {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const storedAvatar = removeAvatar ? null : user.avatarUrl ?? null;
  const avatarSrc = previewUrl ?? storedAvatar;

  const submit = async (values: ProfileDetails) => {
    setSaving(true);
    try {
      // Аватар первым: если он не принят, базовые данные останутся в форме.
      if (avatarFile !== null) {
        await api.uploadAvatar(avatarFile);
      } else if (removeAvatar) {
        await api.removeAvatar();
      }
      await api.update({ displayName: values.displayName.trim(), email: values.email.trim() });
      await onSaved();
    } catch (error) {
      message.error(messageOfError(error, 'Не удалось сохранить профиль.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Правка профиля">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space align="center" size={16}>
          <Avatar size={80} src={avatarSrc ?? undefined}>
            {initialsOf(user.displayName)}
          </Avatar>
          <Space direction="vertical" size={8}>
            <Space>
              <Upload
                accept="image/png,image/jpeg,image/webp,image/gif"
                maxCount={1}
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > AVATAR_MAX_BYTES) {
                    void message.error('Файл больше 5 МБ.');
                    return false;
                  }
                  setAvatarFile(file);
                  setRemoveAvatar(false);
                  // Ручная отправка: файл уходит вместе с кнопкой «Сохранить».
                  return false;
                }}
              >
                <Button disabled={saving}>Загрузить аватар</Button>
              </Upload>
              {avatarFile !== null || (user.avatarUrl != null && !removeAvatar) ? (
                <Button
                  danger
                  disabled={saving}
                  onClick={() => {
                    setAvatarFile(null);
                    setRemoveAvatar(true);
                  }}
                >
                  Удалить
                </Button>
              ) : null}
            </Space>
            <Typography.Text type="secondary">
              PNG или JPEG до 5 МБ. Сервер обрежет изображение до квадрата и сохранит две
              версии — для страницы профиля и для меню.
            </Typography.Text>
          </Space>
        </Space>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ displayName: user.displayName, email: user.email ?? '' }}
          onFinish={(values) => void submit(values)}
          style={{ maxWidth: 420 }}
        >
          <Form.Item
            name="displayName"
            label="Имя"
            rules={[
              { required: true, whitespace: true, message: 'Укажите имя' },
              { max: 255, message: 'Не более 255 символов' },
            ]}
          >
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item name="email" label="Почта" rules={[{ type: 'email', message: 'Некорректная почта' }]}>
            <Input autoComplete="email" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Сохранить
            </Button>
            <Button disabled={saving} onClick={() => form.resetFields()}>
              Сбросить
            </Button>
          </Space>
        </Form>
      </Space>
    </Card>
  );
}
