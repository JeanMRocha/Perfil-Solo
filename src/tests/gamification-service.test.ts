import { beforeEach, describe, expect, it } from 'vitest';
import {
  getGamificationState,
  trackGamificationEvent,
} from '@services/gamificationService';

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

class CustomEventMock<T = unknown> {
  readonly type: string;
  readonly detail: T | undefined;

  constructor(type: string, init?: { detail?: T }) {
    this.type = type;
    this.detail = init?.detail;
  }
}

function installStorageMocks() {
  const localStorageMock = new LocalStorageMock();
  const sessionStorageMock = new LocalStorageMock();
  const eventTargetMock = {
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: eventTargetMock,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: CustomEventMock,
    configurable: true,
  });
}

describe('gamification service', () => {
  beforeEach(() => {
    installStorageMocks();
  });

  it('concede XP base ao cadastrar propriedade', async () => {
    const userId = 'user-gamification-1';
    const initial = getGamificationState(userId);
    expect(initial.xp_total).toBe(0);

    const result = await trackGamificationEvent(userId, 'property_created');

    expect(result.xp_gained).toBeGreaterThanOrEqual(12);
    expect(result.state.events_count.property_created).toBe(1);
    expect(result.state.xp_total).toBe(result.xp_gained);
  });

  it('acumula contagem e XP de propriedades em eventos consecutivos', async () => {
    const userId = 'user-gamification-2';

    await trackGamificationEvent(userId, 'property_created');
    const second = await trackGamificationEvent(userId, 'property_created');

    expect(second.state.events_count.property_created).toBe(2);
    expect(second.state.xp_total).toBeGreaterThanOrEqual(24);
  });
});
