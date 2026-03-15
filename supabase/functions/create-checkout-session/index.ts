// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = {
    priceId?: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function getAllowedPriceIds() {
    return new Set(
        [
            Deno.env.get('STRIPE_PRICE_ID_MONTHLY'),
            Deno.env.get('STRIPE_PRICE_ID_YEARLY'),
            Deno.env.get('STRIPE_PRICE_ID_ANNUALLY'),
            Deno.env.get('EXPO_PUBLIC_STRIPE_PRICE_ID_MONTHLY'),
            Deno.env.get('EXPO_PUBLIC_STRIPE_PRICE_ID_YEARLY'),
            Deno.env.get('EXPO_PUBLIC_STRIPE_PRICE_ID_ANNUALLY'),
        ].filter((value): value is string => Boolean(value)),
    );
}

function hasCurrentAccess(status: string | null, currentPeriodEnd: string | null) {
    if (!status || !['active', 'trialing'].includes(status)) {
        return false;
    }

    if (!currentPeriodEnd) {
        return true;
    }

    return new Date(currentPeriodEnd).getTime() > Date.now();
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
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
        const allowedPriceIds = getAllowedPriceIds();

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
            throw new Error('Missing function environment variables');
        }

        if (allowedPriceIds.size === 0) {
            throw new Error('Missing allowed Stripe price IDs');
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse(401, { error: 'Missing Authorization header' });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: authHeader },
            },
        });
        const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        const token = authHeader.replace('Bearer ', '');
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return jsonResponse(401, { error: 'Unauthorized' });
        }

        const body = (await req.json()) as Payload;
        if (!body?.priceId) {
            return jsonResponse(400, { error: 'priceId is required' });
        }

        if (!allowedPriceIds.has(body.priceId)) {
            return jsonResponse(400, { error: 'Unsupported priceId' });
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });

        // Reuse the existing Stripe customer when possible so billing stays tied to one app user.
        const { data: customerRow, error: customerError } = await adminSupabase
            .from('billing_customers')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (customerError) {
            throw new Error(customerError.message);
        }

        // Prevent users from starting duplicate active subscriptions during MVP.
        const { data: existingSubscription, error: subscriptionError } = await adminSupabase
            .from('subscriptions')
            .select('status,current_period_end')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .order('current_period_end', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

        if (subscriptionError) {
            throw new Error(subscriptionError.message);
        }

        if (existingSubscription && hasCurrentAccess(existingSubscription.status, existingSubscription.current_period_end)) {
            return jsonResponse(409, { error: 'User already has an active subscription' });
        }

        const successUrl =
            Deno.env.get('STRIPE_CHECKOUT_SUCCESS_URL') ??
            `${Deno.env.get('EXPO_PUBLIC_APP_SCHEME') ?? 'spino'}://subscribe/success`;
        const cancelUrl =
            Deno.env.get('STRIPE_CHECKOUT_CANCEL_URL') ??
            `${Deno.env.get('EXPO_PUBLIC_APP_SCHEME') ?? 'spino'}://subscribe/cancel`;

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerRow?.stripe_customer_id ?? undefined,
            customer_email: customerRow?.stripe_customer_id ? undefined : user.email ?? undefined,
            line_items: [{ price: body.priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: user.id,
            metadata: {
                user_id: user.id,
                price_id: body.priceId,
            },
            subscription_data: {
                metadata: {
                    user_id: user.id,
                    price_id: body.priceId,
                },
            },
        });

        if (!session.url) {
            throw new Error('Failed to create Stripe checkout session');
        }

        return jsonResponse(200, { url: session.url });
    } catch (error: any) {
        return jsonResponse(400, { error: error?.message ?? 'Unexpected error' });
    }
});
