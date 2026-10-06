import { makeAutoObservable, reaction, runInAction } from 'mobx';

import type { FileApi, FileObjectDto } from '@/entities/file';
import type { FilterNode, OrderByItem, ODataListResponse, ODataQuery } from '@/shared/api';
import type { AppMessage } from '@/shared/lib';

import { downloadBlob } from '@/features/file-download';
import { t } from '@/shared/i18n';
import { AsyncResource, messageOfError } from '@/shared/lib';

/** Варианты сортировки, которые предлагает страница документов. */
export const FILES_SORTS = ['createdAt-desc', 'createdAt-asc', 'name-asc', 'sizeBytes-desc'] as const;

export type FilesSort = (typeof FILES_SORTS)[number];

const SORT_TO_ORDER_BY: Record<FilesSort, OrderByItem[]> = {
  'createdAt-desc': [{ property: 'createdAt', descending: true }],
  'createdAt-asc': [{ property: 'createdAt' }],
  'name-asc': [{ property: 'name' }],
  'sizeBytes-desc': [{ property: 'sizeBytes', descending: true }],
};

const PAGE_SIZE = 50;

/**
 * Состояние страницы документов: поисковый запрос, порядок сортировки, диалог
 * загрузки и список файлов.
 *
 * Список — это ресурс MobX, задача которого читает observable-значения стора, а
 * reaction запускает запрос при каждом изменении поиска или сортировки. Поэтому
 * страница никогда не запрашивает данные сама, она только отображает то, что
 * хранится в сторе.
 */
export class FilesStore {
  search = '';
  sort: FilesSort = 'createdAt-desc';
  message: AppMessage | undefined = undefined;
  uploadOpen = false;
  submitting = false;

  private readonly fileApi: FileApi;
  private readonly list: AsyncResource<ODataListResponse<FileObjectDto>>;
  private dispose: (() => void) | null = null;

  constructor(fileApi: FileApi) {
    this.fileApi = fileApi;
    this.list = new AsyncResource(() => fileApi.list(this.query));
    makeAutoObservable<FilesStore, 'fileApi' | 'list' | 'dispose'>(
      this,
      { fileApi: false, list: false, dispose: false },
      { autoBind: true },
    );
  }

  get files(): readonly FileObjectDto[] {
    return this.list.data?.value ?? [];
  }

  get loading(): boolean {
    return this.list.loading;
  }

  get error(): unknown {
    return this.list.error;
  }

  get query(): ODataQuery {
    const term = this.search.trim();
    const filter: FilterNode | undefined =
      term === '' ? undefined : { kind: 'function', name: 'contains', property: 'name', value: term };
    return { filter, orderBy: SORT_TO_ORDER_BY[this.sort], top: PAGE_SIZE, count: true };
  }

  /** Ключ запроса, чтобы reaction реагировал на значения, а не на сам объект. */
  get queryKey(): string {
    return `${this.search.trim()}|${this.sort}`;
  }

  /**
   * Реагирует на всё, от чего зависит список. Возвращает disposer, чтобы владелец
   * стора сам решал, когда остановить reactions.
   */
  start(): () => void {
    if (this.dispose === null) {
      const byQuery = reaction(
        () => this.queryKey,
        () => {
          void this.refresh();
        },
        { fireImmediately: true },
      );
      const byFailure = reaction(
        () => this.list.error,
        (error) => {
          if (error !== undefined) {
            this.fail(error);
          }
        },
      );
      this.dispose = () => {
        byQuery();
        byFailure();
      };
    }
    return this.stop;
  }

  stop(): void {
    this.dispose?.();
    this.dispose = null;
  }

  setSearch(search: string): void {
    this.clearMessage();
    this.search = search;
  }

  setSort(sort: FilesSort): void {
    if (sort !== this.sort) {
      this.clearMessage();
      this.sort = sort;
    }
  }

  clearMessage(): void {
    this.message = undefined;
  }

  async refresh(): Promise<void> {
    this.clearMessage();
    await this.list.fetch();
  }

  openUpload(): void {
    this.uploadOpen = true;
  }

  closeUpload(): void {
    this.uploadOpen = false;
  }

  /** Загружает каждый файл из диалога и затем перезагружает список. */
  async upload(files: readonly File[], description: string | undefined): Promise<void> {
    this.clearMessage();
    this.submitting = true;
    try {
      for (const file of files) {
        await this.fileApi.upload(file, description);
      }
      runInAction(() => {
        this.uploadOpen = false;
        this.show({ text: t('documents.message.uploaded', { count: files.length }), design: 'Success' });
      });
      await this.list.fetch();
    } catch (error) {
      runInAction(() => this.fail(error));
    } finally {
      runInAction(() => {
        this.submitting = false;
      });
    }
  }

  async download(file: FileObjectDto): Promise<void> {
    this.clearMessage();
    try {
      const blob = await this.fileApi.downloadContent(file.id);
      downloadBlob(blob, file.name);
      runInAction(() => {
        this.show({ text: t('documents.message.downloaded', { name: file.name }), design: 'Success' });
      });
    } catch (error) {
      runInAction(() => this.fail(error));
    }
  }

  async remove(file: FileObjectDto): Promise<void> {
    this.clearMessage();
    try {
      await this.fileApi.remove(file.id, file.etag);
      runInAction(() => {
        this.show({ text: t('documents.message.deleted', { name: file.name }), design: 'Success' });
      });
      await this.list.fetch();
    } catch (error) {
      runInAction(() => this.fail(error));
    }
  }

  private show(message: AppMessage): void {
    this.message = message;
  }

  private fail(error: unknown): void {
    this.message = { text: messageOfError(error, t('common.unknownError')), design: 'Error' };
  }
}
