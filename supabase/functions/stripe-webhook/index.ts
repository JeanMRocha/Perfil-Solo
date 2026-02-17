// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature')
    const body = await req.text()

    let event
    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature!,
            Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!,
            undefined,
            cryptoProvider
        )
    } catch (err) {
        return new Response(err.message, { status: 400 })
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
        case 'customer.subscription.created': {
            const subscription = event.data.object
            const status = subscription.status
            let planId = 'free'

            // Mapeamento simples de price_id para plan_id
            // Idealmente, isso viria de uma tabela 'plans' ou config
            const priceId = subscription.items.data[0].price.id
            if (priceId === Deno.env.get('STRIPE_PRICE_PRO')) planId = 'pro'
            if (priceId === Deno.env.get('STRIPE_PRICE_ENTERPRISE')) planId = 'enterprise'

            // Atualiza perfil do usuário
            // Assume que o customer.email ou metadata.user_id vincula ao usuário
            // Aqui usamos customer como chave, mas o ideal é metadata
            const { data: user, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('stripe_customer_id', subscription.customer)
                .single()

            if (user) {
                await supabase
                    .from('profiles')
                    .update({
                        plan_id: status === 'active' ? planId : 'free',
                        subscription_status: status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id)
            }
            break
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
    })
})
