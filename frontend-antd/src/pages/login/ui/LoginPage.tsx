import { Button, Card, Select } from 'antd';
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
      <Card className="login-card" title={t('app.title')}>
        <div className="login-card-body">
          <p className="login-description">{t('login.description')}</p>
          {session.error !== undefined && (
            <Message text={messageOfError(session.error, t('app.sessionRestoreFailed'))} design="Error" />
          )}
          {session.failure !== undefined && <Message text={session.failure} design="Error" />}
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
          <Button
            type="primary"
            disabled={mode === 'none'}
            loading={session.pending || session.modeLoading}
            icon={<ICONS.login />}
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
