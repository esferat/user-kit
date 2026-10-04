import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Icon.js';
import '@ui5/webcomponents/dist/MessageStrip.js';
import '@ui5/webcomponents/dist/Text.js';
import '@ui5/webcomponents/dist/Title.js';
import '@ui5/webcomponents/dist/Card.js';
import '@ui5/webcomponents/dist/CardHeader.js';

import type Button from '@ui5/webcomponents/dist/Button.js';
import type MessageStrip from '@ui5/webcomponents/dist/MessageStrip.js';

import type { AuthProvider } from '@/features/auth';
import type { AppConfig } from '@/shared/config';

import { t } from '@/shared/i18n';
import { element, messageOfError, MESSAGE_DESIGN, type MessageDesign } from '@/shared/lib';
import { ICONS } from '@/shared/ui';

export interface LoginPageOptions {
  config: AppConfig;
  auth: AuthProvider;
  onAuthenticated(): void;
}

/** Screen shown as long as nobody is authenticated. */
export function renderLoginPage(root: HTMLElement, options: LoginPageOptions): void {
  const { config, auth, onAuthenticated } = options;

  const host = element('div', { className: 'login-page' });
  const card = element('ui5-card', { className: 'login-card' });
  const header = element('ui5-card-header');
  header.setAttribute('titleText', t('app.title'));
  header.setAttribute('subtitleText', t('login.subtitle'));
  card.appendChild(header);

  const body = element('div', { className: 'login-card-body' });
  body.appendChild(element('ui5-text', { text: t('login.description') }));

  function appendStrip(text: string, design: MessageDesign): void {
    const strip = document.createElement('ui5-message-strip') as MessageStrip;
    strip.setAttribute('design', MESSAGE_DESIGN[design]);
    strip.textContent = text;
    body.appendChild(strip);
  }

  if (config.authMode === 'dev') {
    appendStrip(t('login.devWarning', { role: config.dev.role }), 'Warning');
  } else if (config.oidc.authority === '') {
    appendStrip(t('login.missingAuthority'), 'Error');
  }

  const button = document.createElement('ui5-button') as Button;
  button.design = 'Emphasized';
  button.icon = ICONS.login;
  button.textContent = t('login.submit');
  button.addEventListener('click', () => {
    button.loading = true;
    void auth
      .login(window.location.hash)
      .catch((error: unknown) => {
        const strip = document.createElement('ui5-message-strip') as MessageStrip;
        strip.setAttribute('design', MESSAGE_DESIGN.Error);
        strip.textContent = messageOfError(error, t('login.failed'));
        body.prepend(strip);
      })
      .finally(() => {
        button.loading = false;
        onAuthenticated();
      });
  });

  body.appendChild(button);
  card.appendChild(body);
  host.appendChild(card);
  root.replaceChildren(host);
}
