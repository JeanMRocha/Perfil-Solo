/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_DATA_PROVIDER?: 'local' | 'supabase';
  readonly VITE_OWNER_SUPER_EMAIL?: string;
  readonly VITE_OWNER_SUPER_EMAILS?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
