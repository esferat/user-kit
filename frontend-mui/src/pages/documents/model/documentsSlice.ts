import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { FileApi, FileObjectDto } from '@/entities/file';
import type { FilterNode, ODataListResponse, ODataQuery, OrderByItem } from '@/shared/api';
import type { AppMessage } from '@/shared/lib';

import { downloadBlob } from '@/features/file-download';
import { t } from '@/shared/i18n';
import { messageOfError } from '@/shared/lib';

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

export function buildFilesQuery(search: string, sort: FilesSort): ODataQuery {
  const term = search.trim();
  const filter: FilterNode | undefined =
    term === '' ? undefined : { kind: 'function', name: 'contains', property: 'name', value: term };
  return { filter, orderBy: SORT_TO_ORDER_BY[sort], top: PAGE_SIZE, count: true };
}

export interface DocumentsState {
  search: string;
  sort: FilesSort;
  files: readonly FileObjectDto[];
  loading: boolean;
  error: unknown;
  message: AppMessage | undefined;
  uploadOpen: boolean;
  submitting: boolean;
}

const initialState: DocumentsState = {
  search: '',
  sort: 'createdAt-desc',
  files: [],
  loading: false,
  error: undefined,
  message: undefined,
  uploadOpen: false,
  submitting: false,
};

interface DocumentsServices {
  services: { fileApi: FileApi };
}

function failedMessage(error: unknown): string {
  return messageOfError(error, t('common.unknownError'));
}

/** Загружает список файлов по текущим поиску и сортировке. */
export const listDocuments = createAsyncThunk<ODataListResponse<FileObjectDto>, void, { rejectValue: string }>(
  'documents/list',
  async (_arg, thunkAPI) => {
    const { services } = thunkAPI.extra as DocumentsServices;
    const state = (thunkAPI.getState() as { documents: DocumentsState }).documents;
    try {
      return await services.fileApi.list(buildFilesQuery(state.search, state.sort));
    } catch (error) {
      return thunkAPI.rejectWithValue(failedMessage(error));
    }
  },
);

/** Меняет поисковый запрос и перезагружает список, если эффективный запрос изменился. */
export const searchDocuments = createAsyncThunk<void, string>('documents/search', async (search, thunkAPI) => {
  const state = (thunkAPI.getState() as { documents: DocumentsState }).documents;
  thunkAPI.dispatch(documentsSlice.actions.setSearch(search));
  if (state.search.trim() === search.trim()) {
    return;
  }
  await thunkAPI.dispatch(listDocuments());
});

/** Меняет порядок сортировки и перезагружает список, если он действительно изменился. */
export const sortDocuments = createAsyncThunk<void, FilesSort>('documents/sort', async (sort, thunkAPI) => {
  const state = (thunkAPI.getState() as { documents: DocumentsState }).documents;
  if (state.sort === sort) {
    return;
  }
  thunkAPI.dispatch(documentsSlice.actions.setSort(sort));
  await thunkAPI.dispatch(listDocuments());
});

/** Перезагружает список и заодно очищает сообщение о прошлом действии. */
export const refreshDocuments = createAsyncThunk<void, void>('documents/refresh', async (_arg, thunkAPI) => {
  thunkAPI.dispatch(documentsSlice.actions.clearMessage());
  await thunkAPI.dispatch(listDocuments());
});

export interface UploadRequest {
  files: readonly File[];
  description: string | undefined;
}

/** Загружает каждый файл из диалога, показывает результат и перезагружает список. */
export const uploadDocuments = createAsyncThunk<void, UploadRequest, { rejectValue: string }>(
  'documents/upload',
  async ({ files, description }, thunkAPI) => {
    const { services } = thunkAPI.extra as DocumentsServices;
    try {
      for (const file of files) {
        await services.fileApi.upload(file, description);
      }
      thunkAPI.dispatch(documentsSlice.actions.closeUpload());
      thunkAPI.dispatch(
        documentsSlice.actions.messageShown({
          text: t('documents.message.uploaded', { count: files.length }),
          design: 'Success',
        }),
      );
    } catch (error) {
      return thunkAPI.rejectWithValue(failedMessage(error));
    }
    await thunkAPI.dispatch(listDocuments());
  },
);

/** Скачивает файл и сообщает об успехе. */
export const downloadDocument = createAsyncThunk<void, FileObjectDto, { rejectValue: string }>(
  'documents/download',
  async (file, thunkAPI) => {
    const { services } = thunkAPI.extra as DocumentsServices;
    try {
      const blob = await services.fileApi.downloadContent(file.id);
      downloadBlob(blob, file.name);
      thunkAPI.dispatch(
        documentsSlice.actions.messageShown({
          text: t('documents.message.downloaded', { name: file.name }),
          design: 'Success',
        }),
      );
    } catch (error) {
      return thunkAPI.rejectWithValue(failedMessage(error));
    }
  },
);

/** Удаляет файл с его версией и перезагружает список. */
export const removeDocument = createAsyncThunk<void, FileObjectDto, { rejectValue: string }>(
  'documents/remove',
  async (file, thunkAPI) => {
    const { services } = thunkAPI.extra as DocumentsServices;
    try {
      await services.fileApi.remove(file.id, file.etag);
      thunkAPI.dispatch(
        documentsSlice.actions.messageShown({
          text: t('documents.message.deleted', { name: file.name }),
          design: 'Success',
        }),
      );
    } catch (error) {
      return thunkAPI.rejectWithValue(failedMessage(error));
    }
    await thunkAPI.dispatch(listDocuments());
  },
);

export const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setSearch(state, action: PayloadAction<string>) {
      state.message = undefined;
      state.search = action.payload;
    },
    setSort(state, action: PayloadAction<FilesSort>) {
      if (action.payload !== state.sort) {
        state.message = undefined;
        state.sort = action.payload;
      }
    },
    clearMessage(state) {
      state.message = undefined;
    },
    openUpload(state) {
      state.uploadOpen = true;
    },
    closeUpload(state) {
      state.uploadOpen = false;
    },
    messageShown(state, action: PayloadAction<AppMessage>) {
      state.message = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(listDocuments.pending, (state) => {
        state.loading = true;
      })
      .addCase(listDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.error = undefined;
        state.files = action.payload.value;
      })
      .addCase(listDocuments.rejected, (state, action) => {
        const text = action.payload ?? t('common.unknownError');
        state.loading = false;
        state.error = new Error(text);
        state.message = { text, design: 'Error' };
      })
      .addCase(uploadDocuments.pending, (state) => {
        state.message = undefined;
        state.submitting = true;
      })
      .addCase(uploadDocuments.fulfilled, (state) => {
        state.submitting = false;
      })
      .addCase(uploadDocuments.rejected, (state, action) => {
        const text = action.payload ?? t('common.unknownError');
        state.submitting = false;
        state.message = { text, design: 'Error' };
      })
      .addCase(downloadDocument.rejected, (state, action) => {
        const text = action.payload ?? t('common.unknownError');
        state.message = { text, design: 'Error' };
      })
      .addCase(removeDocument.rejected, (state, action) => {
        const text = action.payload ?? t('common.unknownError');
        state.message = { text, design: 'Error' };
      });
  },
});

export const documentsReducer = documentsSlice.reducer;

/** Открывает и закрывает диалог загрузки файлов. */
export const { closeUpload, openUpload } = documentsSlice.actions;

export function selectDocuments(state: { documents: DocumentsState }): DocumentsState {
  return state.documents;
}
