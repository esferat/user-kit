import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './downloadBlob';

describe('downloadBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers the blob as a download under the given file name', () => {
    const createObjectURL = vi.fn(() => 'blob:user-kit/1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue();

    const blob = new Blob(['hello from the smoke test']);
    downloadBlob(blob, 'renamed.txt');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:user-kit/1');
  });
});
