import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Icon.js';
import '@ui5/webcomponents/dist/Input.js';
import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Title.js';
import '@ui5/webcomponents/dist/Toolbar.js';
import '@ui5/webcomponents/dist/ToolbarSpacer.js';
import '@ui5/webcomponents-fiori/dist/Page.js';

import type Button from '@ui5/webcomponents/dist/Button.js';
import type Input from '@ui5/webcomponents/dist/Input.js';
import type Option from '@ui5/webcomponents/dist/Option.js';
import type Select from '@ui5/webcomponents/dist/Select.js';

import type { FileApi, FileObjectDto } from '@/entities/file';
import type { FilterNode, OrderByItem } from '@/shared/api';

import { downloadBlob } from '@/features/file-download';
import { createUploadDialog } from '@/features/file-upload';
import { t } from '@/shared/i18n';
import { detailOf, element, messageOfError, showMessage, type MessageDesign } from '@/shared/lib';
import { ICONS } from '@/shared/ui';
import { createDocumentsTable } from '@/widgets/documents-table';

type SortKey = 'createdAt-desc' | 'createdAt-asc' | 'name-asc' | 'sizeBytes-desc';

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; key: string }> = [
  { value: 'createdAt-desc', key: 'documents.sort.newest' },
  { value: 'createdAt-asc', key: 'documents.sort.oldest' },
  { value: 'name-asc', key: 'documents.sort.name' },
  { value: 'sizeBytes-desc', key: 'documents.sort.sizeDesc' },
];

const SORT_TO_ORDER_BY: Record<SortKey, OrderByItem[]> = {
  'createdAt-desc': [{ property: 'createdAt', descending: true }],
  'createdAt-asc': [{ property: 'createdAt' }],
  'name-asc': [{ property: 'name' }],
  'sizeBytes-desc': [{ property: 'sizeBytes', descending: true }],
};

export interface DocumentsPageOptions {
  fileApi: FileApi;
}

/** Documents page: search, sorting, upload and the table of the stored files. */
export function createDocumentsPage(options: DocumentsPageOptions): HTMLElement {
  const { fileApi } = options;
  const page = element('ui5-page');
  const pageHeader = element('header', { attributes: { slot: 'header' } });
  pageHeader.classList.add('page-header');
  const pageContent = element('div', { className: 'page-content' });

  const title = document.createElement('ui5-title');
  title.textContent = t('documents.title');

  const uploadButton = document.createElement('ui5-button') as Button;
  uploadButton.design = 'Emphasized';
  uploadButton.icon = ICONS.upload;
  uploadButton.textContent = t('documents.upload');

  const refreshButton = document.createElement('ui5-button') as Button;
  refreshButton.icon = ICONS.refresh;
  refreshButton.tooltip = t('documents.refresh');
  refreshButton.accessibleName = t('documents.refresh');
  refreshButton.iconOnly = true;

  const searchInput = document.createElement('ui5-input') as Input;
  searchInput.placeholder = t('documents.search');
  searchInput.accessibleName = t('documents.search');
  searchInput.showClearIcon = true;
  searchInput.addEventListener('input', () => {
    clearMessages();
    void load();
  });

  const sortSelect = document.createElement('ui5-select') as Select;
  sortSelect.accessibleName = t('documents.sort.label');
  SORT_OPTIONS.forEach((sort) => {
    const option = document.createElement('ui5-option') as Option;
    option.value = sort.value;
    option.textContent = t(sort.key);
    sortSelect.appendChild(option);
  });
  sortSelect.value = SORT_OPTIONS[0].value;
  sortSelect.addEventListener('change', (event) => {
    const { selectedOption } = detailOf<{ selectedOption: Option }>(event);
    if (selectedOption?.value !== undefined) {
      sortSelect.value = selectedOption.value;
      clearMessages();
      void load();
    }
  });

  const toolbarSpacer = document.createElement('ui5-toolbar-spacer');
  const toolbar = element('ui5-toolbar');
  toolbar.append(searchInput, sortSelect, toolbarSpacer, refreshButton, uploadButton);
  pageHeader.append(title, toolbar);
  page.append(pageHeader, pageContent);

  const messageHost = element('div', { className: 'message-host' });

  const notify = (text: string, design: MessageDesign): void => {
    showMessage(messageHost, text, design);
  };

  /**
   * Drops the messages of the previous interaction. It is deliberately not part of
   * `load()`: an upload or a delete reloads the table right after it, and that
   * reload must not swallow the message that reported its result.
   */
  const clearMessages = (): void => {
    messageHost.replaceChildren();
  };

  const table = createDocumentsTable({
    onAction: (action, file) => {
      void (action === 'download' ? download(file) : remove(file));
    },
  });

  async function load(): Promise<void> {
    table.setLoading(true);
    const searchTerm = searchInput.value.trim();
    const filter: FilterNode | undefined =
      searchTerm === '' ? undefined : { kind: 'function', name: 'contains', property: 'name', value: searchTerm };

    try {
      const response = await fileApi.list({
        filter,
        orderBy: SORT_TO_ORDER_BY[sortSelect.value as SortKey] ?? SORT_TO_ORDER_BY['createdAt-desc'],
        top: 50,
        count: true,
      });

      table.setFiles(response.value);
    } catch (error) {
      notify(messageOfError(error, t('common.unknownError')), 'Error');
    } finally {
      table.setLoading(false);
    }
  }

  async function download(file: FileObjectDto): Promise<void> {
    try {
      const blob = await fileApi.downloadContent(file.id);
      downloadBlob(blob, file.name);
      notify(t('documents.message.downloaded', { name: file.name }), 'Success');
    } catch (error) {
      notify(messageOfError(error, t('common.unknownError')), 'Error');
    }
  }

  async function remove(file: FileObjectDto): Promise<void> {
    try {
      await fileApi.remove(file.id, file.etag);
      notify(t('documents.message.deleted', { name: file.name }), 'Success');
      await load();
    } catch (error) {
      notify(messageOfError(error, t('common.unknownError')), 'Error');
    }
  }

  const dialog = createUploadDialog();
  dialog.onSubmit((files, description) => {
    void upload(files, description);
  });

  async function upload(files: readonly File[], description: string | undefined): Promise<void> {
    dialog.setSubmitting(true);
    try {
      for (const file of files) {
        await fileApi.upload(file, description);
      }
      dialog.close();
      notify(t('documents.message.uploaded', { count: files.length }), 'Success');
      await load();
    } catch (error) {
      notify(messageOfError(error, t('common.unknownError')), 'Error');
    } finally {
      dialog.setSubmitting(false);
    }
  }

  uploadButton.addEventListener('click', () => {
    dialog.open();
  });
  refreshButton.addEventListener('click', () => {
    clearMessages();
    void load();
  });

  pageContent.append(messageHost, table.element);
  page.appendChild(dialog.element);

  void load();

  return page;
}
