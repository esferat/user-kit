import '@ui5/webcomponents-icons/dist/AllIcons.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/styles/app.css';

import { App, ErrorBoundary } from '@/app';

const container = document.getElementById('app');

if (container === null) {
  throw new Error('Root element #app not found');
}

// Регистрирует коллекции SAP-icons-v4 и SAP-icons-v5. Без этого каждый ui5-icon
// и каждая иконка, которую компонент рендерит внутренне, сообщает "No loader
// registered for the SAP-icons-v5 icons collection" и остаётся пустой.
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
