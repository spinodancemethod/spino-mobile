// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function jsonResponse(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function unixToIso(timestamp?: number | null) {
    return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

async function resolveUserId(adminSupabase: any, explicitUserId: string | undefined, stripeCustomerId: string | null) {
    if (explicitUserId) {
        return explicitUserId;
    }

    if (!stripeCustomerId) {
        return null;
    }

    const { data, error } = await adminSupabase
        .from('billing_customers')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data?.user_id ?? null;
}

async function upsertBillingCustomer(adminSupabase: any, userId: string | null, stripeCustomerId: string | null) {
    if (!userId || !stripeCustomerId) {
        return;
    }

    const { error } = await adminSupabase.from('billing_customers').upsert(
        {
            user_id: userId,
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
    );

    if (error) {
        throw new Error(error.message);
    }
}

async function upsertSubscription(adminSupabase: any, userId: string, subscription: any) {
    const { error } = await adminSupabase.from('subscriptions').upsert(
        {
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id:
                typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
            stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
            status: subscription.status,
            current_period_end: unixToIso(subscription.current_period_end),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            raw_payload: subscription,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_subscription_id' },
    );

    if (error) {
        throw new Error(error.message);
    }
}

async function markEventProcessed(adminSupabase: any, event: Stripe.Event) {
    const { error } = await adminSupabase.from('stripe_webhook_events').insert({
        event_id: event.id,
        event_type: event.type,
        payload: event,
    });

    if (!error) {
        return false;
    }

    if (error.code === '23505') {
        return true;
    }

    throw new Error(error.message);
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
        const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
        const stripeSignature = req.headers.get('stripe-signature');

        if (!supabaseUrl || !supabaseServiceRoleKey || !stripeSecretKey || !stripeWebhookSecret) {
            throw new Error('Missing function environment variables');
        }

        if (!stripeSignature) {
            return jsonResponse(400, { error: 'Missing Stripe signature header' });
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });
        const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        const rawBody = await req.text();
        const event = await stripe.webhooks.constructEventAsync(rawBody, stripeSignature, stripeWebhookSecret);

        const isDuplicate = await markEventProcessed(adminSupabase, event);
        if (isDuplicate) {
            return jsonResponse(200, { received: true, duplicate: true });
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
                const explicitUserId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;
                const userId = await resolveUserId(adminSupabase, explicitUserId, stripeCustomerId);

                await upsertBillingCustomer(adminSupabase, userId, stripeCustomerId);

                if (session.subscription && userId) {
                    const subscriptionId =
                        typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    await upsertSubscription(adminSupabase, userId, subscription);
                }
                break;
            }

            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
                const subscriptionId =
                    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;

                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const userId = await resolveUserId(
                        adminSupabase,
                        subscription.metadata?.user_id,
                        stripeCustomerId,
                    );

                    await upsertBillingCustomer(adminSupabase, userId, stripeCustomerId);

                    if (userId) {
                        await upsertSubscription(adminSupabase, userId, subscription);
                    }
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const stripeCustomerId =
                    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;
                const userId = await resolveUserId(
                    adminSupabase,
                    subscription.metadata?.user_id,
                    stripeCustomerId,
                );

                await upsertBillingCustomer(adminSupabase, userId, stripeCustomerId);

                if (userId) {
                    await upsertSubscription(adminSupabase, userId, subscription);
                }
                break;
            }

            default:
                break;
        }

        return jsonResponse(200, { received: true });
    } catch (error: any) {
        return jsonResponse(400, { error: error?.message ?? 'Unexpected error' });
    }
});