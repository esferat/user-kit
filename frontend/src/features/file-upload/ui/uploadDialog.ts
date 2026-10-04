import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Dialog.js';
import '@ui5/webcomponents/dist/FileUploader.js';
import '@ui5/webcomponents/dist/Input.js';

import type Button from '@ui5/webcomponents/dist/Button.js';
import type Dialog from '@ui5/webcomponents/dist/Dialog.js';
import type FileUploader from '@ui5/webcomponents/dist/FileUploader.js';
import type Input from '@ui5/webcomponents/dist/Input.js';

import { t } from '@/shared/i18n';
import { element } from '@/shared/lib';

export type UploadSubmit = (files: readonly File[], description: string | undefined) => void;

export interface UploadDialog {
  readonly element: HTMLElement;
  open(): void;
  close(): void;
  onSubmit(submit: UploadSubmit): void;
  /** Shows the progress of the upload and disables the confirm button. */
  setSubmitting(submitting: boolean): void;
}

/** Dialog that collects the files and the optional description of an upload. */
export function createUploadDialog(): UploadDialog {
  const dialog = document.createElement('ui5-dialog') as Dialog;
  dialog.headerText = t('documents.upload.title');

  const descriptionInput = document.createElement('ui5-input') as Input;
  descriptionInput.placeholder = t('documents.upload.description');

  const fileUploader = document.createElement('ui5-file-uploader') as FileUploader;
  fileUploader.placeholder = t('documents.upload.placeholder');

  const confirmButton = document.createElement('ui5-button') as Button;
  confirmButton.design = 'Emphasized';
  confirmButton.textContent = t('documents.upload');
  confirmButton.disabled = true;

  const cancelButton = document.createElement('ui5-button') as Button;
  cancelButton.textContent = t('common.cancel');
  cancelButton.addEventListener('click', () => {
    dialog.open = false;
  });

  const dialogFooter = element('div', { className: 'dialog-footer' });
  dialogFooter.append(cancelButton, confirmButton);
  const dialogFooterSlot = element('div', { attributes: { slot: 'footer' } });
  dialogFooterSlot.appendChild(dialogFooter);

  dialog.append(descriptionInput, fileUploader, dialogFooterSlot);

  const listeners: UploadSubmit[] = [];

  const reset = (): void => {
    fileUploader.value = '';
    descriptionInput.value = '';
    confirmButton.disabled = true;
    confirmButton.loading = false;
  };

  fileUploader.addEventListener('change', () => {
    confirmButton.disabled = (fileUploader.files?.length ?? 0) === 0;
  });

  confirmButton.addEventListener('click', () => {
    const files = Array.from(fileUploader.files ?? []);
    if (files.length === 0) {
      return;
    }
    const description = descriptionInput.value.trim();
    listeners.forEach((listener) => listener(files, description === '' ? undefined : description));
  });

  return {
    element: dialog,
    open(): void {
      dialog.open = true;
    },
    close(): void {
      dialog.open = false;
      reset();
    },
    onSubmit(submit: UploadSubmit): void {
      listeners.push(submit);
    },
    setSubmitting(submitting: boolean): void {
      confirmButton.loading = submitting;
      confirmButton.disabled = submitting || (fileUploader.files?.length ?? 0) === 0;
    },
  };
}
