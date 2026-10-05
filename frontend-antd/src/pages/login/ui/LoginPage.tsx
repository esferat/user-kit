import { Button, Card, Select } from 'antd';
import { useEffect, useState } from 'react';

import type { AuthMode } from '@/features/auth';
import type { AppConfig } from '@/shared/config';

import { DEFAULT_ROLE, ROLES } from '@/entities/user';
import { useAuthSession } from '@/features/auth';
import { useTranslate } from '@/shared/i18n';
import { messageOfError } from '@/shared/lib';
import { ICONS, Message } from '@/shared/ui';

export interface LoginPageProps {
  config: AppConfig;
}

/** Screen shown as long as nobody is authenticated. */
export function LoginPage({ config }: LoginPageProps) {
  const t = useTranslate();
  const { auth, error, login } = useAuthSession();
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [role, setRole] = useState(config.dev.role === 'admin' ? 'admin' : DEFAULT_ROLE);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  // The backend decides which login exists, so the screen can only adapt once
  // it has answered.
  useEffect(() => {
    let active = true;
    void auth.mode().then(
      (answer) => {
        if (active) {
          setMode(answer);
        }
      },
      (reason: unknown) => {
        if (active) {
          setFailure(messageOfError(reason, t('login.failed')));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [auth, t]);

  function start(): void {
    setPending(true);
    setFailure(undefined);
    void login(window.location.hash, role).catch((reason: unknown) => {
      setFailure(messageOfError(reason, t('login.failed')));
      setPending(false);
    });
  }

  return (
    <div className="login-page">
      <Card className="login-card" title={t('app.title')}>
        <div className="login-card-body">
          <p className="login-description">{t('login.description')}</p>
          {error !== undefined && (
            <Message text={messageOfError(error, t('app.sessionRestoreFailed'))} design="Error" />
          )}
          {failure !== undefined && <Message text={failure} design="Error" />}
          {mode === 'none' && <Message text={t('login.noProvider')} design="Error" />}
          {mode === 'dev' && (
            <>
              <Message text={t('login.devWarning', { role })} design="Warning" />
              <Select
                aria-label={t('login.role.label')}
                value={role}
                options={ROLES.map((entry) => ({ label: t(`login.role.${entry}`), value: entry }))}
                onChange={setRole}
              />
            </>
          )}
          <Button type="primary" disabled={mode === 'none'} loading={pending} icon={<ICONS.login />} onClick={start}>
            {t('login.submit')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
