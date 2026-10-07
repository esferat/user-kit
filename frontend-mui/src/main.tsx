import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/styles/app.css';

import { App, ErrorBoundary } from '@/app';

const container = document.getElementById('app');

if (container === null) {
  throw new Error('Root element #app not found');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
