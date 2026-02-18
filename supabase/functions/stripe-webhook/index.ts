import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!,
      undefined,
      cryptoProvider,
    );
  } catch (err: any) {
    return new Response(err?.message ?? 'Invalid signature', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscription.status;
      const priceId = subscription.items.data[0]?.price?.id ?? '';
      const metadataUserId = subscription.metadata?.user_id;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      let planId: 'free' | 'pro' | 'enterprise' = 'free';
      if (priceId === Deno.env.get('STRIPE_PRICE_PRO')) planId = 'pro';
      if (priceId === Deno.env.get('STRIPE_PRICE_ENTERPRISE'))
        planId = 'enterprise';

      let userId: string | null = metadataUserId ?? null;
      if (!userId) {
        const { data: profileByCustomer } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        userId = profileByCustomer?.id ?? null;
      }

      if (userId) {
        await supabase
          .from('profiles')
          .update({
            plan_id: status === 'active' ? planId : 'free',
            subscription_status: status,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }
      break;
    }
    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
