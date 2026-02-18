import { describe, expect, it } from 'vitest';
import {
  buildProfileSubscriptionUpdate,
  resolvePlanFromPrice,
} from '../../supabase/functions/_shared/billingLogic';

describe('Stripe billing logic (edge shared)', () => {
  it('resolvePlanFromPrice mapeia corretamente os price ids', () => {
    expect(resolvePlanFromPrice('price_pro', 'price_pro', 'price_ent')).toBe(
      'pro',
    );
    expect(resolvePlanFromPrice('price_ent', 'price_pro', 'price_ent')).toBe(
      'enterprise',
    );
    expect(resolvePlanFromPrice('unknown', 'price_pro', 'price_ent')).toBe(
      'free',
    );
  });

  it('buildProfileSubscriptionUpdate mantem plano pago quando status ativo', () => {
    const payload = buildProfileSubscriptionUpdate({
      status: 'active',
      planId: 'pro',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
      currentPeriodEnd: 1760000000,
    });

    expect(payload.plan_id).toBe('pro');
    expect(payload.subscription_status).toBe('active');
    expect(payload.stripe_customer_id).toBe('cus_1');
    expect(payload.stripe_subscription_id).toBe('sub_1');
    expect(payload.current_period_end).toBe(
      new Date(1760000000 * 1000).toISOString(),
    );
    expect(typeof payload.updated_at).toBe('string');
  });

  it('buildProfileSubscriptionUpdate força free quando assinatura nao esta ativa', () => {
    const payload = buildProfileSubscriptionUpdate({
      status: 'canceled',
      planId: 'enterprise',
      customerId: 'cus_2',
      subscriptionId: 'sub_2',
      currentPeriodEnd: null,
    });

    expect(payload.plan_id).toBe('free');
    expect(payload.current_period_end).toBeNull();
  });
});
