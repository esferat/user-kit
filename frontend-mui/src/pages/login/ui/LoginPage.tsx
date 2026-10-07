import { Button, CircularProgress, MenuItem, Paper, TextField } from '@mui/material';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { AppConfig } from '@/shared/config';
import type { AppDispatch } from '@/shared/lib';

import { DEFAULT_ROLE, ROLES } from '@/entities/user';
import { login, selectSession } from '@/features/auth';
import { useTranslate } from '@/shared/i18n';
import { messageOfError } from '@/shared/lib';
import { ICONS, Message } from '@/shared/ui';

export interface LoginPageProps {
  config: AppConfig;
}

/**
 * Экран, который показывается, пока никто не аутентифицирован. Слайс сессии
 * сообщает, какие способы входа доступны, поэтому экран подстраивается только
 * после ответа backend.
 */
export function LoginPage({ config }: LoginPageProps) {
  const t = useTranslate();
  const dispatch = useDispatch<AppDispatch>();
  const session = useSelector(selectSession);
  const [role, setRole] = useState(config.dev.role === 'admin' ? 'admin' : DEFAULT_ROLE);
  const mode = session.loginMode;
  const busy = session.pending || session.modeLoading;

  return (
    <div className="login-page">
      <Paper className="login-card" elevation={0} variant="outlined">
        <div className="login-card-body">
          <header>
            <h2 className="app-header-primary">{t('app.title')}</h2>
          </header>
          <p className="login-description">{t('login.description')}</p>
          {session.error !== undefined && (
            <Message text={messageOfError(session.error, t('app.sessionRestoreFailed'))} design="Error" />
          )}
          {session.failure !== undefined && <Message text={session.failure} design="Error" />}
          {mode === 'none' && <Message text={t('login.noProvider')} design="Error" />}
          {mode === 'dev' && (
            <>
              <Message text={t('login.devWarning', { role })} design="Warning" />
              <TextField
                select
                inputProps={{ 'aria-label': t('login.role.label') }}
                size="small"
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as 'admin' | 'user');
                }}
              >
                {ROLES.map((entry) => (
                  <MenuItem key={entry} value={entry}>
                    {t(`login.role.${entry}`)}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
          <Button
            variant="contained"
            disabled={mode === 'none'}
            startIcon={busy ? <CircularProgress className="login-spin" size={16} color="inherit" /> : <ICONS.login />}
            onClick={() => {
              void dispatch(login({ returnUrl: window.location.hash, role }));
            }}
          >
            {t('login.submit')}
          </Button>
        </div>
      </Paper>
    </div>
  );
}
