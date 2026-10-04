import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createUploadDialog } from './uploadDialog';

import { i18n } from '@/shared/i18n';

type DialogElement = HTMLElement & { open: boolean };
type InputElement = Element & { value: string };
type UploaderElement = Element & { value: string; files?: FileList | null };
type ButtonElement = Element & { disabled: boolean; loading: boolean; textContent: string | null };

function query<T extends Element>(root: HTMLElement, selector: string): T {
  return root.querySelector(selector) as T;
}

function buttons(root: HTMLElement): ButtonElement[] {
  return [...root.querySelectorAll('ui5-button')] as ButtonElement[];
}

function createFile(name: string): File {
  return new File(['hello from the smoke test'], name, { type: 'text/plain' });
}

function selectFiles(uploader: UploaderElement, files: File[]): void {
  Object.defineProperty(uploader, 'files', { configurable: true, value: files });
  uploader.dispatchEvent(new CustomEvent('change'));
}

describe('createUploadDialog', () => {
  beforeEach(() => {
    i18n.setLocale('ru');
  });

  it('renders the dialog with the translated labels', () => {
    const dialog = createUploadDialog();

    expect((dialog.element as DialogElement).open).toBe(false);
    expect(query<InputElement>(dialog.element, 'ui5-input').value).toBe('');
    expect(buttons(dialog.element).map((button) => button.textContent)).toEqual([
      i18n.t('common.cancel'),
      i18n.t('documents.upload'),
    ]);
  });

  it('opens and closes the dialog', () => {
    const dialog = createUploadDialog();
    const host = dialog.element as DialogElement;

    dialog.open();
    expect(host.open).toBe(true);

    dialog.close();
    expect(host.open).toBe(false);
  });

  it('closes the dialog with the cancel button', () => {
    const dialog = createUploadDialog();
    const host = dialog.element as DialogElement;

    dialog.open();
    buttons(dialog.element)[0].dispatchEvent(new CustomEvent('click'));

    expect(host.open).toBe(false);
  });

  it('enables the confirm button only when a file was selected', () => {
    const dialog = createUploadDialog();
    const uploader = query<UploaderElement>(dialog.element, 'ui5-file-uploader');
    const [, confirm] = buttons(dialog.element);

    expect(confirm.disabled).toBe(true);

    selectFiles(uploader, [createFile('hello.txt')]);
    expect(confirm.disabled).toBe(false);

    selectFiles(uploader, []);
    expect(confirm.disabled).toBe(true);
  });

  it('submits the selected files and the trimmed description', () => {
    const dialog = createUploadDialog();
    const onSubmit = vi.fn();
    dialog.onSubmit(onSubmit);

    const file = createFile('hello.txt');
    selectFiles(query<UploaderElement>(dialog.element, 'ui5-file-uploader'), [file, createFile('second.txt')]);
    query<InputElement>(dialog.element, 'ui5-input').value = '  описание  ';
    buttons(dialog.element)[1].dispatchEvent(new CustomEvent('click'));

    expect(onSubmit).toHaveBeenCalledWith([file, expect.objectContaining({ name: 'second.txt' })], 'описание');
  });

  it('submits without a description when the field is empty', () => {
    const dialog = createUploadDialog();
    const onSubmit = vi.fn();
    dialog.onSubmit(onSubmit);

    selectFiles(query<UploaderElement>(dialog.element, 'ui5-file-uploader'), [createFile('hello.txt')]);
    buttons(dialog.element)[1].dispatchEvent(new CustomEvent('click'));

    expect(onSubmit).toHaveBeenCalledWith([expect.objectContaining({ name: 'hello.txt' })], undefined);
  });

  it('notifies every registered submit listener', () => {
    const dialog = createUploadDialog();
    const first = vi.fn();
    const second = vi.fn();
    dialog.onSubmit(first);
    dialog.onSubmit(second);

    selectFiles(query<UploaderElement>(dialog.element, 'ui5-file-uploader'), [createFile('hello.txt')]);
    buttons(dialog.element)[1].dispatchEvent(new CustomEvent('click'));

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('does nothing when the confirm button is used without a file', () => {
    const dialog = createUploadDialog();
    const onSubmit = vi.fn();
    dialog.onSubmit(onSubmit);

    buttons(dialog.element)[1].dispatchEvent(new CustomEvent('click'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the progress while the upload runs and blocks a second attempt', () => {
    const dialog = createUploadDialog();
    const uploader = query<UploaderElement>(dialog.element, 'ui5-file-uploader');
    const [, confirm] = buttons(dialog.element);
    selectFiles(uploader, [createFile('hello.txt')]);

    dialog.setSubmitting(true);
    expect(confirm.loading).toBe(true);
    expect(confirm.disabled).toBe(true);

    dialog.setSubmitting(false);
    expect(confirm.loading).toBe(false);
    expect(confirm.disabled).toBe(false);
  });

  it('resets the form when it is closed', () => {
    const dialog = createUploadDialog();
    const uploader = query<UploaderElement>(dialog.element, 'ui5-file-uploader');
    const description = query<InputElement>(dialog.element, 'ui5-input');
    const [, confirm] = buttons(dialog.element);
    selectFiles(uploader, [createFile('hello.txt')]);
    description.value = 'описание';

    dialog.close();

    expect(uploader.value).toBe('');
    expect(description.value).toBe('');
    expect(confirm.disabled).toBe(true);
    expect(confirm.loading).toBe(false);
  });
});
