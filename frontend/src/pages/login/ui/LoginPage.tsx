import { Button } from '@ui5/webcomponents-react/Button';
import { Card } from '@ui5/webcomponents-react/Card';
import { CardHeader } from '@ui5/webcomponents-react/CardHeader';
import { Option } from '@ui5/webcomponents-react/Option';
import { Select } from '@ui5/webcomponents-react/Select';
import { Text } from '@ui5/webcomponents-react/Text';
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
      <Card className="login-card">
        <CardHeader titleText={t('app.title')} subtitleText={t('login.subtitle')} />
        <div className="login-card-body">
          <Text>{t('login.description')}</Text>
          {error !== undefined && (
            <Message text={messageOfError(error, t('app.sessionRestoreFailed'))} design="Error" />
          )}
          {failure !== undefined && <Message text={failure} design="Error" />}
          {mode === 'none' && <Message text={t('login.noProvider')} design="Error" />}
          {mode === 'dev' && (
            <>
              <Message text={t('login.devWarning', { role })} design="Warning" />
              <Select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                {ROLES.map((entry) => (
                  <Option key={entry} value={entry}>
                    {t(`login.role.${entry}`)}
                  </Option>
                ))}
              </Select>
            </>
          )}
          <Button design="Emphasized" disabled={mode === 'none'} icon={ICONS.login} loading={pending} onClick={start}>
            {t('login.submit')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
