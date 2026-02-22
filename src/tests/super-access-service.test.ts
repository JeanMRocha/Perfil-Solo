import { beforeEach, describe, expect, it } from 'vitest';
import {
  isOwnerSuperUser,
  parseOwnerSuperEmails,
} from '@services/superAccessService';
import { getUserAppMode, updateUserAppMode } from '@services/userPreferencesService';

const USER_PREFERENCES_KEY_PREFIX = 'perfilsolo_user_preferences_v1';

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

function installStorageMocks() {
  const localStorageMock = new LocalStorageMock();
  const sessionStorageMock = new LocalStorageMock();

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    },
    configurable: true,
  });
}

describe('super access service', () => {
  beforeEach(() => {
    installStorageMocks();
  });

  it('normaliza lista de emails do super usuário dono', () => {
    const parsed = parseOwnerSuperEmails(
      ' DONO@perfilsolo.app,owner@perfilsolo.app; dono@perfilsolo.app ',
    );
    expect(parsed).toEqual(['dono@perfilsolo.app', 'owner@perfilsolo.app']);
  });

  it('valida se o email pertence ao dono', () => {
    const allowed = ['dono@perfilsolo.app'];
    expect(isOwnerSuperUser(' DONO@perfilsolo.app ', allowed)).toBe(true);
    expect(isOwnerSuperUser('user@perfilsolo.app', allowed)).toBe(false);
  });

  it('permite acesso super por role em metadata mesmo sem email na allowlist', () => {
    const authUser = {
      email: 'user@perfilsolo.app',
      app_metadata: {
        role: 'admin',
      },
      user_metadata: {},
    };
    expect(isOwnerSuperUser(authUser, [])).toBe(true);
  });

  it('permite acesso super por flag explicita em metadata', () => {
    const authUser = {
      email: 'user@perfilsolo.app',
      app_metadata: {},
      user_metadata: {
        is_super_user: true,
      },
    };
    expect(isOwnerSuperUser(authUser, [])).toBe(true);
  });

  it('forca modo normal para qualquer email não dono', () => {
    const userId = 'user-123';
    const storageKey = `${USER_PREFERENCES_KEY_PREFIX}:${userId}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ mode: 'super', view: { menu_text_visible: true } }),
    );

    expect(getUserAppMode(userId, 'user@perfilsolo.app')).toBe('normal');

    const updated = updateUserAppMode('super', userId, 'user@perfilsolo.app');
    expect(updated.mode).toBe('normal');
  });
});
