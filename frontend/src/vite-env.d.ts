/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_UI5_THEME?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
  readonly VITE_DEV_ROLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
