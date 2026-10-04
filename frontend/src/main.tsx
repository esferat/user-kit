import '@ui5/webcomponents-icons/dist/AllIcons.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/styles/app.css';

import { App, ErrorBoundary } from '@/app';

const container = document.getElementById('app');

if (container === null) {
  throw new Error('Root element #app not found');
}

// Registers the SAP-icons-v4 and SAP-icons-v5 collections. Without it every
// ui5-icon and every icon a component renders internally reports "No loader
// registered for the SAP-icons-v5 icons collection" and stays empty.
createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
