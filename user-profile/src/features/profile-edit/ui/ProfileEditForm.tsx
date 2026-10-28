import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { App, Avatar, Button, Card, Form, Input, Space, Typography, Upload } from 'antd';

import { profileKeys, publishProfileUpdated, useProfileQuery } from '@entities/user';
import { appConfig } from '@shared/config';
import {
  initialsOf,
  messageOfError,
  type SafeActionResult,
  type SafeReadResult,
} from '@shared/lib';
import { profileDetailsSchema, type MeResponse, type ProfileDetails } from '@shared/model';

import { removeAvatar, updateProfile, uploadAvatar } from '../api/profileApi';

export interface ProfileEditFormProps {
  /**
   * Вызывается после успешного сохранения. Вызывающая сторона сама решает,
   * что дальше: перечитать сессию, показать уведомление, вернуться назад.
   */
  onSaved?: () => void | Promise<void>;
}

/**
 * Форма правки базовых данных и аватара.
 *
 * Валидация одна и та же на клиенте и на сервере: схема zod лежит в
 * `shared/model`, здесь она подключена через `zodResolver`, а BFF прогоняет
 * через неё же тело запроса в `safeAction`.
 */
export function ProfileEditForm({ onSaved }: ProfileEditFormProps) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const profile = useProfileQuery();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarDropRequested, setAvatarDropRequested] = useState(false);

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

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileDetails>({
    resolver: zodResolver(profileDetailsSchema),
    // `values` сбрасывает форму, когда сервер отдал свежий профиль.
    values: {
      displayName: profile.data?.displayName ?? '',
      email: profile.data?.email ?? '',
    },
  });

  /** Раскладывает безопасный результат BFF по корзинам react-hook-form. */
  const applyResult = async (
    result: SafeActionResult<MeResponse, ProfileDetails> | SafeReadResult<MeResponse>,
  ): Promise<boolean> => {
    if ('validationErrors' in result) {
      if (result.serverError !== null) {
        message.error(result.serverError);
        return false;
      }
      if (result.validationErrors !== null) {
        for (const [field, messages] of Object.entries(result.validationErrors)) {
          setError(field as keyof ProfileDetails, {
            message: messages?.[0] ?? 'Некорректное значение',
          });
        }
        return false;
      }
    } else if (result.error !== null) {
      message.error(result.error);
      return false;
    }
    return true;
  };

  const save = handleSubmit(async (values) => {
    // Аватар первым: если его не приняли, базовые данные останутся в форме.
    if (avatarFile !== null) {
      if (!(await applyResult(await uploadAvatar(avatarFile)))) {
        return;
      }
    } else if (avatarDropRequested) {
      if (!(await applyResult(await removeAvatar()))) {
        return;
      }
    }

    const result = await updateProfile({
      displayName: values.displayName.trim(),
      email: values.email.trim(),
    });
    if (!(await applyResult(result))) {
      return;
    }

    setAvatarFile(null);
    setAvatarDropRequested(false);
    // В своей вкладке кеш обновит синглтон QueryClient, а соседние вкладки
    // узнают про правку через шину profileSync.
    await queryClient.invalidateQueries({ queryKey: profileKeys.current });
    publishProfileUpdated();
    reset();
    message.success('Профиль сохранён');
    await onSaved?.();
  });

  const current = profile.data;
  const avatarSrc = previewUrl ?? (avatarDropRequested ? null : (current?.avatarUrl ?? null));

  if (profile.isPending) {
    return (
      <Card title="Правка профиля">
        <Avatar size={80} />
        <Typography.Paragraph style={{ marginTop: 16 }}>Загружаем профиль…</Typography.Paragraph>
      </Card>
    );
  }

  if (profile.isError || current === undefined) {
    return (
      <Card title="Правка профиля">
        <Typography.Paragraph type="danger">
          {messageOfError(profile.error, 'Не удалось прочитать профиль.')}
        </Typography.Paragraph>
        <Button onClick={() => void profile.refetch()}>Повторить</Button>
      </Card>
    );
  }

  const avatarShown = avatarFile !== null || (current.avatarUrl != null && !avatarDropRequested);

  return (
    <Card title="Правка профиля">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space align="center" size={16}>
          <Avatar size={80} src={avatarSrc ?? undefined}>
            {initialsOf(current.displayName)}
          </Avatar>
          <Space direction="vertical" size={8}>
            <Space>
              <Upload
                accept="image/png,image/jpeg"
                maxCount={1}
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > appConfig.avatarMaxBytes) {
                    void message.error('Файл больше 5 МБ.');
                    return Upload.LIST_IGNORE;
                  }
                  setAvatarFile(file);
                  setAvatarDropRequested(false);
                  // Ручная отправка: файл уходит вместе с кнопкой «Сохранить».
                  return false;
                }}
              >
                <Button disabled={isSubmitting}>Загрузить аватар</Button>
              </Upload>
              {avatarShown ? (
                <Button
                  danger
                  disabled={isSubmitting}
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarDropRequested(true);
                  }}
                >
                  Удалить
                </Button>
              ) : null}
            </Space>
            <Typography.Text type="secondary">
              PNG или JPEG до 5 МБ. Сервер обрежет изображение до квадрата и сохранит две версии —
              для страницы профиля и для меню.
            </Typography.Text>
          </Space>
        </Space>

        <Form layout="vertical" onFinish={() => void save()} style={{ maxWidth: 420 }}>
          <Form.Item
            label="Имя"
            validateStatus={errors.displayName ? 'error' : ''}
            help={errors.displayName?.message}
          >
            <Controller
              name="displayName"
              control={control}
              render={({ field }) => <Input {...field} autoComplete="name" />}
            />
          </Form.Item>
          <Form.Item
            label="Почта"
            validateStatus={errors.email ? 'error' : ''}
            help={errors.email?.message}
          >
            <Controller
              name="email"
              control={control}
              render={({ field }) => <Input {...field} autoComplete="email" />}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              Сохранить
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                setAvatarFile(null);
                setAvatarDropRequested(false);
                reset();
              }}
            >
              Сбросить
            </Button>
          </Space>
        </Form>
      </Space>
    </Card>
  );
}
