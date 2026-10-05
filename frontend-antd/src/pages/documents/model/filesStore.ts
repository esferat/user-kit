import { makeAutoObservable, reaction, runInAction } from 'mobx';

import type { FileApi, FileObjectDto } from '@/entities/file';
import type { FilterNode, OrderByItem, ODataListResponse, ODataQuery } from '@/shared/api';
import type { AppMessage } from '@/shared/lib';

import { downloadBlob } from '@/features/file-download';
import { t } from '@/shared/i18n';
import { AsyncResource, messageOfError } from '@/shared/lib';

/** Orderings the documents page offers. */
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
 * State of the documents page: the search term, the ordering, the upload dialog
 * and the list of files.
 *
 * The list is a MobX resource whose task reads the observables of the store, and
 * a reaction starts the request whenever the search or the ordering changes. The
 * page therefore never fetches on its own, it only renders what the store holds.
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

  /** Key of the query, so the reaction reacts to the values and not to the object. */
  get queryKey(): string {
    return `${this.search.trim()}|${this.sort}`;
  }

  /**
   * Reacts to everything the list depends on. Returns the disposer, so the owner
   * of the store decides when the reactions stop.
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

  /** Uploads every file of the dialog and reloads the list afterwards. */
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
