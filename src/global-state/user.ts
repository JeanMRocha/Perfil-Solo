import type { User } from '@supabase/supabase-js';
import { atom, onMount } from 'nanostores';
import { isLocalDataMode } from '@services/dataProvider';
import { supabaseClient } from '@sb/supabaseClient';

const LOCAL_AUTH_EMAIL_KEY = 'perfilsolo_local_auth_email';
const LOCAL_AUTH_SESSION_KEY = 'perfilsolo_local_auth_session';
const DEFAULT_LOCAL_EMAIL = 'local@perfilsolo.app';

function buildLocalUser(email: string): User {
  const now = new Date().toISOString();
  return {
    id: 'local-user',
    aud: 'authenticated',
    created_at: now,
    email,
    app_metadata: { provider: 'local' },
    user_metadata: {
      name: 'Usuario Local',
      mode: 'local',
    },
  } as User;
}

function normalizeEmail(input?: string): string {
  const candidate = (input ?? '').trim().toLowerCase();
  if (!candidate) return DEFAULT_LOCAL_EMAIL;
  return candidate;
}

function getLocalAuthEmail(): string {
  const saved = localStorage.getItem(LOCAL_AUTH_EMAIL_KEY);
  return normalizeEmail(saved ?? DEFAULT_LOCAL_EMAIL);
}

function hasLocalSession(): boolean {
  return localStorage.getItem(LOCAL_AUTH_SESSION_KEY) === '1';
}

export const $currUser = atom<User | null | undefined>(undefined);

export function signInLocal(email?: string): User {
  const normalized = normalizeEmail(email);
  localStorage.setItem(LOCAL_AUTH_SESSION_KEY, '1');
  localStorage.setItem(LOCAL_AUTH_EMAIL_KEY, normalized);
  const localUser = buildLocalUser(normalized);
  $currUser.set(localUser);
  return localUser;
}

onMount($currUser, () => {
  if (isLocalDataMode) {
    $currUser.set(hasLocalSession() ? buildLocalUser(getLocalAuthEmail()) : null);
    return () => {};
  }

  let unsubscribe: (() => void) | undefined;

  (async () => {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.warn('[auth] getSession error:', error.message);
      $currUser.set(null);
      return;
    }

    $currUser.set(data.session?.user ?? null);

    const { data: sub } = supabaseClient.auth.onAuthStateChange(
      (event: string, session: any) => {
        console.log('[auth] onAuthStateChange:', event);
        $currUser.set(session?.user ?? null);
      },
    );

    unsubscribe = () => sub.subscription.unsubscribe();
  })();

  return () => {
    unsubscribe?.();
  };
});

export async function signOut() {
  if (isLocalDataMode) {
    localStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
    localStorage.removeItem(LOCAL_AUTH_EMAIL_KEY);
    $currUser.set(null);
    return;
  }

  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  $currUser.set(null);
}
