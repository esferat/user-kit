import '@/app/styles/app.css';
// Registers the SAP-icons-v4 and SAP-icons-v5 collections. Without it every
// ui5-icon and every icon a component renders internally reports "No loader
// registered for the SAP-icons-v5 icons collection" and stays empty.
import '@ui5/webcomponents-icons/dist/AllIcons.js';
import { bootstrap, renderStartupError } from '@/app';

const root = document.getElementById('app');

if (root === null) {
  throw new Error('Root element #app not found');
}

bootstrap(root).catch((error: unknown) => {
  renderStartupError(root, error);
});
