import { Button } from '@ui5/webcomponents-react/Button';
import { Card } from '@ui5/webcomponents-react/Card';
import { CardHeader } from '@ui5/webcomponents-react/CardHeader';
import { Text } from '@ui5/webcomponents-react/Text';
import { useState } from 'react';

import type { AppConfig } from '@/shared/config';

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
  const { error, login } = useAuthSession();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  function start(): void {
    setPending(true);
    setFailure(undefined);
    void login(window.location.hash).catch((reason: unknown) => {
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
          {config.authMode === 'dev' && (
            <Message text={t('login.devWarning', { role: config.dev.role })} design="Warning" />
          )}
          {config.authMode !== 'dev' && config.oidc.authority === '' && (
            <Message text={t('login.missingAuthority')} design="Error" />
          )}
          <Button design="Emphasized" icon={ICONS.login} loading={pending} onClick={start}>
            {t('login.submit')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
