import { beforeEach, describe, expect, it } from 'vitest';
import {
  attachUserToReferralCode,
  ensureStoreReferralProfile,
  getStoreRecurringOverviewForUser,
  getStoreQuotaBonusByUser,
  listStorePurchaseReceiptsForUser,
  listStoreReferralRewardEventsForUser,
  purchaseAppStoreItem,
} from '@services/appStoreService';
import { getUserCredits, setCreditsForUser } from '@services/creditsService';

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

describe('app store service', () => {
  beforeEach(() => {
    installStorageMocks();
  });

  it('compra cota recorrente e atualiza compromisso mensal', async () => {
    const userId = 'store-user-1';
    setCreditsForUser(userId, 500, 'test');

    const result = await purchaseAppStoreItem({
      user_id: userId,
      item_id: 'quota_talhao_slot',
      quantity: 3,
      created_by: userId,
    });

    expect(result.receipt.quantity).toBe(3);
    expect(result.receipt.pricing_mode).toBe('recurring_brl');
    expect(result.receipt.total_cost_credits).toBe(0);
    expect(result.referral_event).toBeNull();
    expect(getUserCredits(userId)).toBe(500);

    const bonuses = getStoreQuotaBonusByUser(userId);
    expect(bonuses.talhoes).toBe(3);
    expect(bonuses.properties).toBe(0);
    expect(bonuses.analises).toBe(0);
    const recurring = getStoreRecurringOverviewForUser(userId);
    expect(recurring.total_monthly_cents).toBeGreaterThan(0);
    expect(recurring.lines[0]?.quantity).toBe(3);

    const receipts = listStorePurchaseReceiptsForUser(userId);
    expect(receipts.length).toBe(1);
    expect(receipts[0]?.id).toBe(result.receipt.id);
  });

  it('aplica recompensa de indicacao apenas na primeira compra do indicado', async () => {
    const referrerId = 'store-referrer-1';
    const invitedId = 'store-invited-1';

    setCreditsForUser(referrerId, 0, 'test');
    setCreditsForUser(invitedId, 200, 'test');

    const referrerProfile = ensureStoreReferralProfile(referrerId);
    ensureStoreReferralProfile(invitedId);
    attachUserToReferralCode({
      user_id: invitedId,
      referral_code: referrerProfile.referral_code,
    });

    const first = await purchaseAppStoreItem({
      user_id: invitedId,
      item_id: 'service_ai_analysis_ticket',
      quantity: 1,
      created_by: invitedId,
    });
    expect(first.referral_event).not.toBeNull();

    expect(getUserCredits(referrerId)).toBe(5);
    expect(getUserCredits(invitedId)).toBe(160);

    const invitedBonus = getStoreQuotaBonusByUser(invitedId);
    expect(invitedBonus.talhoes).toBe(1);
    expect(invitedBonus.analises).toBe(10);

    await purchaseAppStoreItem({
      user_id: invitedId,
      item_id: 'service_ai_analysis_ticket',
      quantity: 1,
      created_by: invitedId,
    });

    expect(getUserCredits(referrerId)).toBe(5);
    expect(listStoreReferralRewardEventsForUser(invitedId)).toHaveLength(1);
  });

  it('bloqueia compra de item em breve', async () => {
    const userId = 'store-coming-soon-1';
    setCreditsForUser(userId, 300, 'test');

    await expect(
      purchaseAppStoreItem({
        user_id: userId,
        item_id: 'bundle_farm_expansion',
        quantity: 1,
        created_by: userId,
      }),
    ).rejects.toThrow(/ainda nao esta disponivel/i);
  });
});
