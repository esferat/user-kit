import { getIconData, getIconDataSync } from '@ui5/webcomponents-base/dist/asset-registries/Icons.js';
import { describe, expect, it } from 'vitest';

import { ICONS } from './icons';

import type { IconData } from '@ui5/webcomponents-base/dist/asset-registries/Icons.js';

async function load(name: string, collection = 'SAP-icons-v5'): Promise<IconData | undefined> {
  // getIconData triggers the collection loader, getIconDataSync then reads the
  // cache. Together they prove the icon is registered and carries path data.
  await getIconData(`${collection}/${name}`);

  return getIconDataSync(`${collection}/${name}`);
}

const ICON_NAMES: string[] = [...new Set(Object.values(ICONS))];

describe('SAP icon collections', () => {
  it('registers a loader for the default collection', async () => {
    const iconData = await load('home');

    expect(iconData?.pathData).toBeTruthy();
    expect(iconData?.collection).toBe('SAP-icons-v5');
  });

  it.each(ICON_NAMES)('resolves the application icon "%s" in the v5 collection', async (name) => {
    expect(await load(name), name).toBeDefined();
  });

  it.each(ICON_NAMES)('resolves the application icon "%s" in the v4 collection', async (name) => {
    // A legacy theme family renders the v4 collection, so both must be complete.
    expect(await load(name, 'SAP-icons-v4'), name).toBeDefined();
  });

  it('resolves icons that components render internally', async () => {
    // Icons used by ui5-input, ui5-table, ui5-message-strip, ui5-file-uploader
    // and ui5-shellbar. A missing one leaves an empty box in the UI.
    const internal = [
      'add',
      'decline',
      'error',
      'information',
      'warning',
      'sort-ascending',
      'sort-descending',
      'edit',
      'settings',
    ];

    for (const name of internal) {
      expect(await load(name), name).toBeDefined();
    }
  });

  it('reports an unknown icon instead of throwing', async () => {
    expect(await getIconData('definitely-not-an-icon')).toBeUndefined();
  });
});
