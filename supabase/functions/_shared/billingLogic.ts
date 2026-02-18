export type BillingPlanId = 'free' | 'pro' | 'enterprise';

export function resolvePlanFromPrice(
  priceId: string,
  proPriceId?: string | null,
  enterprisePriceId?: string | null,
): BillingPlanId {
  if (proPriceId && priceId === proPriceId) return 'pro';
  if (enterprisePriceId && priceId === enterprisePriceId) return 'enterprise';
  return 'free';
}

export function buildProfileSubscriptionUpdate(input: {
  status: string;
  planId: BillingPlanId;
  customerId: string;
  subscriptionId: string;
  currentPeriodEnd?: number | null;
}) {
  const periodEndIso =
    input.currentPeriodEnd && input.currentPeriodEnd > 0
      ? new Date(input.currentPeriodEnd * 1000).toISOString()
      : null;

  return {
    plan_id: input.status === 'active' ? input.planId : 'free',
    subscription_status: input.status,
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,
    current_period_end: periodEndIso,
    updated_at: new Date().toISOString(),
  };
}
