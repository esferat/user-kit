import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadDialog } from './UploadDialog';

import { i18n } from '@/shared/i18n';

const FILE = new File(['payload'], 'report.txt', { type: 'text/plain' });

/** `Dialog` Material UI рендерит своё содержимое в portal в конце document body. */
function buttons(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('.MuiDialogActions-root button')];
}

function descriptionInput(root: HTMLElement): HTMLInputElement {
  return root.querySelector('.upload-dialog-body input[aria-label][placeholder]') as HTMLInputElement;
}

/** Выбор файлов приходит из скрытого file input диалога. */
function chooseFiles(root: HTMLElement, files: readonly File[]): void {
  const input = root.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  fireEvent.change(input);
}

async function selectFiles(root: HTMLElement, files: readonly File[]): Promise<void> {
  chooseFiles(root, files);
  await waitFor(() => expect(buttons(root)[1].disabled).toBe(false));
}

function typeDescription(root: HTMLElement, value: string): void {
  fireEvent.change(descriptionInput(root), { target: { value } });
}

function renderDialog(props: Partial<Parameters<typeof UploadDialog>[0]> = {}) {
  return render(
    <UploadDialog open submitting={false} onClose={() => undefined} onSubmit={() => undefined} {...props} />,
  );
}

beforeEach(() => {
  i18n.setLocale('ru');
});

describe('UploadDialog', () => {
  it('offers the fields of an upload', () => {
    const { baseElement } = renderDialog();

    expect(baseElement.querySelector('.MuiDialogTitle-root')?.textContent).toContain(i18n.t('documents.upload.title'));
    expect(baseElement.querySelector('input[type="file"]')).not.toBeNull();
    expect(descriptionInput(baseElement)).not.toBeNull();
    expect(buttons(baseElement).map((button) => button.textContent)).toEqual([
      i18n.t('common.cancel'),
      i18n.t('documents.upload'),
    ]);
  });

  it('keeps the confirm button disabled until files are chosen', async () => {
    const { baseElement } = renderDialog();

    expect(buttons(baseElement)[1].disabled).toBe(true);

    await selectFiles(baseElement, [FILE]);

    expect(buttons(baseElement)[1].disabled).toBe(false);
  });

  it('submits the files and the trimmed description', async () => {
    const onSubmit = vi.fn();
    const { baseElement } = renderDialog({ onSubmit });

    await selectFiles(baseElement, [FILE]);
    typeDescription(baseElement, '  quarterly numbers  ');
    fireEvent.click(buttons(baseElement)[1]);

    expect(onSubmit).toHaveBeenCalledWith([FILE], 'quarterly numbers');
  });

  it('submits no description when the field is empty', async () => {
    const onSubmit = vi.fn();
    const { baseElement } = renderDialog({ onSubmit });

    await selectFiles(baseElement, [FILE]);
    typeDescription(baseElement, '   ');
    fireEvent.click(buttons(baseElement)[1]);

    expect(onSubmit).toHaveBeenCalledWith([FILE], undefined);
  });

  it('reports every chosen file, one upload per file', async () => {
    const onSubmit = vi.fn();
    const second = new File(['more'], 'notes.md', { type: 'text/markdown' });
    const { baseElement } = renderDialog({ onSubmit });

    await selectFiles(baseElement, [FILE, second]);
    fireEvent.click(buttons(baseElement)[1]);

    expect((onSubmit.mock.calls[0][0] as File[]).map((file) => file.name)).toEqual(['report.txt', 'notes.md']);
  });

  it('closes on cancel', async () => {
    const onClose = vi.fn();
    const { baseElement } = renderDialog({ onClose });

    await selectFiles(baseElement, [FILE]);
    fireEvent.click(buttons(baseElement)[0]);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on the Escape key of the dialog', () => {
    const onClose = vi.fn();
    const { baseElement } = renderDialog({ onClose });

    fireEvent.keyDown(baseElement.querySelector('[role="dialog"]') as Element, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('starts empty when the page closes the dialog after a successful upload', async () => {
    const onSubmit = vi.fn();
    const { baseElement, rerender } = renderDialog({ onSubmit });

    await selectFiles(baseElement, [FILE]);
    typeDescription(baseElement, 'quarterly numbers');
    rerender(<UploadDialog open={false} submitting={false} onClose={() => undefined} onSubmit={onSubmit} />);
    rerender(<UploadDialog open submitting={false} onClose={() => undefined} onSubmit={onSubmit} />);

    expect(descriptionInput(baseElement).value).toBe('');
    expect(buttons(baseElement)[1].disabled).toBe(true);
  });

  it('shows the progress and locks the confirm button while uploading', async () => {
    const { baseElement } = renderDialog({ submitting: true });

    chooseFiles(baseElement, [FILE]);
    await waitFor(() => expect(baseElement.querySelector('.upload-list')).not.toBeNull());

    expect(buttons(baseElement)[1].querySelector('.submit-spin')).not.toBeNull();
    expect(buttons(baseElement)[1].disabled).toBe(true);
  });
});
