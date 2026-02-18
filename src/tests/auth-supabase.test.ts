import { beforeEach, describe, expect, it } from 'vitest';
import { $currUser, signInLocal, signOut } from '@global/user';
import { supabaseClient } from '@sb/supabaseClient';
import { isLocalDataMode } from '@services/dataProvider';

const LOCAL_AUTH_EMAIL_KEY = 'perfilsolo_local_auth_email';
const LOCAL_AUTH_SESSION_KEY = 'perfilsolo_local_auth_session';

class LocalStorageMock {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

describe('Auth local e Supabase stub', () => {
  beforeEach(() => {
    const localStorageMock = new LocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
    $currUser.set(undefined);
  });

  it('normaliza email ao fazer login local', () => {
    expect(isLocalDataMode).toBe(true);

    const user = signInLocal('  USER@Example.COM ');

    expect(user.email).toBe('user@example.com');
    expect(localStorage.getItem(LOCAL_AUTH_EMAIL_KEY)).toBe(
      'user@example.com',
    );
    expect(localStorage.getItem(LOCAL_AUTH_SESSION_KEY)).toBe('1');
    expect($currUser.get()?.email).toBe('user@example.com');
  });

  it('remove sessao local ao fazer logout', async () => {
    expect(isLocalDataMode).toBe(true);

    signInLocal('local@perfilsolo.app');
    await signOut();

    expect(localStorage.getItem(LOCAL_AUTH_EMAIL_KEY)).toBeNull();
    expect(localStorage.getItem(LOCAL_AUTH_SESSION_KEY)).toBeNull();
    expect($currUser.get()).toBeNull();
  });

  it('retorna erro offline no stub de auth do Supabase', async () => {
    expect(isLocalDataMode).toBe(true);

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: 'a@b.com',
      password: '123456',
    });

    expect(error).toBeTruthy();
    expect(error.message).toContain('Supabase desabilitado no modo local');
  });

  it('query stub retorna sucesso vazio por padrao', async () => {
    expect(isLocalDataMode).toBe(true);

    const result = await supabaseClient.from('profiles').select('*');

    expect(result.error).toBeNull();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});
