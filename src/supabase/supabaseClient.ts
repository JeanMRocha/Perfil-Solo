import { createClient } from '@supabase/supabase-js';
import { isLocalDataMode } from '@services/dataProvider';
import type { Database } from './supabase';

function createQueryStub(defaultData: any = []): any {
  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    lte: () => builder,
    gte: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (resolve: any) =>
      Promise.resolve({ data: defaultData, error: null }).then(resolve),
    catch: (reject: any) => Promise.resolve({ data: defaultData, error: null }).catch(reject),
  };

  return builder;
}

function createSupabaseStub() {
  const offlineError = {
    message:
      'Supabase desabilitado no modo local (VITE_DATA_PROVIDER=local).',
  };

  return {
    auth: {
      signInWithPassword: async () => ({ data: null, error: offlineError }),
      signUp: async () => ({ data: { session: null, user: null }, error: offlineError }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    functions: {
      invoke: async () => ({ data: null, error: offlineError }),
    },
    from: () => createQueryStub([]),
  };
}

function debug(message: string, data?: unknown) {
  console.log(`[SupabaseClient] ${message}`, data ?? '');
}

let supabaseClient: any;

if (isLocalDataMode) {
  debug('Modo local ativo. Supabase em stub offline.');
  supabaseClient = createSupabaseStub();
} else {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    debug('Supabase URL/KEY ausentes. Aplicando stub de segurança.');
    supabaseClient = createSupabaseStub();
  } else {
    supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    debug('SupabaseClient criado com sucesso', { url: supabaseUrl });
  }
}

export { supabaseClient };
