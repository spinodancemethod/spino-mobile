// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Payload = {
    priceId?: string;
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

        if (!supabaseUrl || !supabaseAnonKey || !stripeSecretKey) {
            throw new Error('Missing function environment variables');
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: authHeader },
            },
        });

        const token = authHeader.replace('Bearer ', '');
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const body = (await req.json()) as Payload;
        if (!body?.priceId) {
            return new Response(JSON.stringify({ error: 'priceId is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2024-06-20',
        });

        const successUrl =
            Deno.env.get('STRIPE_CHECKOUT_SUCCESS_URL') ??
            `${Deno.env.get('EXPO_PUBLIC_APP_SCHEME') ?? 'spino'}://subscribe/success`;
        const cancelUrl =
            Deno.env.get('STRIPE_CHECKOUT_CANCEL_URL') ??
            `${Deno.env.get('EXPO_PUBLIC_APP_SCHEME') ?? 'spino'}://subscribe/cancel`;

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: user.email ?? undefined,
            line_items: [{ price: body.priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                user_id: user.id,
            },
        });

        if (!session.url) {
            throw new Error('Failed to create Stripe checkout session');
        }

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error?.message ?? 'Unexpected error' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
