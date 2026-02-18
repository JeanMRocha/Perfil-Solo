/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_DATA_PROVIDER?: 'local' | 'supabase';
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
