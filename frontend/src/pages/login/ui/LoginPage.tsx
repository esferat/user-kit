import { Button } from '@ui5/webcomponents-react/Button';
import { Card } from '@ui5/webcomponents-react/Card';
import { CardHeader } from '@ui5/webcomponents-react/CardHeader';
import { Option } from '@ui5/webcomponents-react/Option';
import { Select } from '@ui5/webcomponents-react/Select';
import { Text } from '@ui5/webcomponents-react/Text';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { AppConfig } from '@/shared/config';

import { DEFAULT_ROLE, ROLES } from '@/entities/user';
import { useAuthSession } from '@/features/auth';
import { useTranslate } from '@/shared/i18n';
import { messageOfError } from '@/shared/lib';
import { ICONS, Message } from '@/shared/ui';

export interface LoginPageProps {
  config: AppConfig;
}

/**
 * Screen shown as long as nobody is authenticated. The session store answers
 * which login exists, so the screen only adapts once the backend has replied.
 */
function LoginPageView({ config }: LoginPageProps) {
  const t = useTranslate();
  const session = useAuthSession();
  const [role, setRole] = useState(config.dev.role === 'admin' ? 'admin' : DEFAULT_ROLE);
  const mode = session.loginMode;

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardHeader titleText={t('app.title')} subtitleText={t('login.subtitle')} />
        <div className="login-card-body">
          <Text>{t('login.description')}</Text>
          {session.error !== undefined && (
            <Message text={messageOfError(session.error, t('app.sessionRestoreFailed'))} design="Error" />
          )}
          {session.failure !== undefined && <Message text={session.failure} design="Error" />}
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
          <Button
            design="Emphasized"
            disabled={mode === 'none'}
            icon={ICONS.login}
            loading={session.pending || session.modeLoading}
            onClick={() => {
              void session.login(window.location.hash, role);
            }}
          >
            {t('login.submit')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export const LoginPage = observer(LoginPageView);
