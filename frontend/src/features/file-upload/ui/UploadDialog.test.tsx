import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadDialog } from './UploadDialog';

import { i18n } from '@/shared/i18n';

const FILE = new File(['payload'], 'report.txt', { type: 'text/plain' });

interface Ui5Element {
  open: boolean;
  value: string;
  disabled: boolean;
  loading: boolean;
  files: FileList | null;
}

function dialog(container: HTMLElement): HTMLElement & Ui5Element {
  return container.querySelector('ui5-dialog') as HTMLElement & Ui5Element;
}

function buttons(container: HTMLElement): (HTMLElement & { disabled: boolean; loading: boolean })[] {
  return [...container.querySelectorAll('ui5-button')] as (HTMLElement & { disabled: boolean; loading: boolean })[];
}

/** UI5 сообщает о выбранных файлах на загрузчике через read-only свойство. */
function selectFiles(container: HTMLElement, files: readonly File[]): void {
  const uploader = container.querySelector('ui5-file-uploader') as HTMLElement;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  Object.defineProperty(uploader, 'files', { configurable: true, get: () => transfer.files });
  fireEvent(uploader, new CustomEvent('change', { bubbles: true }));
}

function typeDescription(container: HTMLElement, value: string): void {
  const input = container.querySelector('ui5-input') as HTMLElement & { value: string };
  input.value = value;
  fireEvent(input, new CustomEvent('change', { bubbles: true }));
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('UploadDialog', () => {
  it('offers the fields of an upload', () => {
    const { container } = render(
      <UploadDialog open submitting={false} onClose={() => undefined} onSubmit={() => undefined} />,
    );

    expect(dialog(container).open).toBe(true);
    expect(container.querySelector('ui5-file-uploader')).not.toBeNull();
    expect(container.querySelector('ui5-input')).not.toBeNull();
    expect(buttons(container).map((button) => button.textContent)).toEqual([
      i18n.t('common.cancel'),
      i18n.t('documents.upload'),
    ]);
  });

  it('keeps the confirm button disabled until files are chosen', () => {
    const { container } = render(
      <UploadDialog open submitting={false} onClose={() => undefined} onSubmit={() => undefined} />,
    );

    expect(buttons(container)[1].disabled).toBe(true);

    selectFiles(container, [FILE]);

    expect(buttons(container)[1].disabled).toBe(false);
  });

  it('submits the files and the trimmed description', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <UploadDialog open submitting={false} onClose={() => undefined} onSubmit={onSubmit} />,
    );
    selectFiles(container, [FILE]);
    typeDescription(container, '  quarterly numbers  ');

    fireEvent.click(buttons(container)[1]);

    expect(onSubmit).toHaveBeenCalledWith([FILE], 'quarterly numbers');
  });

  it('submits no description when the field is empty', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <UploadDialog open submitting={false} onClose={() => undefined} onSubmit={onSubmit} />,
    );
    selectFiles(container, [FILE]);
    typeDescription(container, '   ');

    fireEvent.click(buttons(container)[1]);

    expect(onSubmit).toHaveBeenCalledWith([FILE], undefined);
  });

  it('reports the files as they are, one upload per file', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <UploadDialog open submitting={false} onClose={() => undefined} onSubmit={onSubmit} />,
    );
    selectFiles(container, [FILE]);

    fireEvent.click(buttons(container)[1]);

    expect(onSubmit.mock.calls[0][0]).toHaveLength(1);
    expect((onSubmit.mock.calls[0][0] as File[])[0].name).toBe('report.txt');
  });

  it('closes on cancel and forgets the selection', () => {
    const onClose = vi.fn();
    const { container } = render(<UploadDialog open submitting={false} onClose={onClose} onSubmit={() => undefined} />);
    selectFiles(container, [FILE]);

    fireEvent.click(buttons(container)[0]);

    expect(onClose).toHaveBeenCalledOnce();
    expect(container.querySelector('ui5-file-uploader')?.getAttribute('value')).not.toBe(FILE.name);
  });

  it('closes when the dialog itself asks to close', () => {
    const onClose = vi.fn();
    const { container } = render(<UploadDialog open submitting={false} onClose={onClose} onSubmit={() => undefined} />);

    fireEvent(dialog(container), new CustomEvent('close', { bubbles: true }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('starts empty when the page closes the dialog after a successful upload', () => {
    const onSubmit = vi.fn();
    const { container, rerender } = render(
      <UploadDialog open submitting={false} onClose={() => undefined} onSubmit={onSubmit} />,
    );
    selectFiles(container, [FILE]);
    typeDescription(container, 'quarterly numbers');

    rerender(<UploadDialog open={false} submitting={false} onClose={() => undefined} onSubmit={onSubmit} />);
    rerender(<UploadDialog open submitting={false} onClose={() => undefined} onSubmit={onSubmit} />);

    expect((container.querySelector('ui5-input') as HTMLElement & { value: string }).value).toBe('');
    expect(buttons(container)[1].disabled).toBe(true);
  });

  it('shows the progress and locks the confirm button while uploading', () => {
    const { container } = render(<UploadDialog open submitting onClose={() => undefined} onSubmit={() => undefined} />);
    selectFiles(container, [FILE]);

    expect(buttons(container)[1].loading).toBe(true);
    expect(buttons(container)[1].disabled).toBe(true);
  });
});
