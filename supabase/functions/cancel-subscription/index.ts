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

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
            throw new Error('Missing function environment variables');
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

        const { data: subscriptionRow, error: subscriptionError } = await adminSupabase
            .from('subscriptions')
            .select('id,stripe_subscription_id,status,current_period_end,cancel_at_period_end')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .order('current_period_end', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

        if (subscriptionError) {
            throw new Error(subscriptionError.message);
        }

        if (!subscriptionRow?.stripe_subscription_id) {
            return jsonResponse(404, { error: 'No active subscription found' });
        }

        if (subscriptionRow.cancel_at_period_end) {
            return jsonResponse(200, {
                ok: true,
                alreadyScheduled: true,
                status: subscriptionRow.status,
                currentPeriodEnd: subscriptionRow.current_period_end,
            });
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });

        // For MVP we schedule cancellation at period end so users keep paid access through the current cycle.
        const stripeSubscription = await stripe.subscriptions.update(subscriptionRow.stripe_subscription_id, {
            cancel_at_period_end: true,
        });

        const { error: updateError } = await adminSupabase
            .from('subscriptions')
            .update({
                status: stripeSubscription.status,
                current_period_end: unixToIso(stripeSubscription.current_period_end),
                cancel_at_period_end: stripeSubscription.cancel_at_period_end ?? true,
                raw_payload: stripeSubscription,
                updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', stripeSubscription.id);

        if (updateError) {
            throw new Error(updateError.message);
        }

        return jsonResponse(200, {
            ok: true,
            canceled: true,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end ?? true,
            currentPeriodEnd: unixToIso(stripeSubscription.current_period_end),
        });
    } catch (error: any) {
        return jsonResponse(400, { error: error?.message ?? 'Unexpected error' });
    }
});
