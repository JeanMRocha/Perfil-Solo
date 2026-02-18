const DATA_PROVIDER = (import.meta.env.VITE_DATA_PROVIDER ?? 'local')
  .toString()
  .trim()
  .toLowerCase();

export const isLocalDataMode = DATA_PROVIDER !== 'supabase';
export const isSupabaseMode = !isLocalDataMode;

export const dataProviderLabel = isLocalDataMode ? 'local' : 'supabase';
