/// <reference path="../_shared/edge-runtime-types.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
    getEntitlementSource,
    mapRevenueCatEventToSubscription,
    parseBasePlanId,
    resolveUserId,
    shouldUpsertSubscription,
    toIsoFromMs,
    type RevenueCatWebhookEvent,
} from '../../../lib/billing/revenuecatWebhookMapping.ts';
import { corsHeaders } from '../_shared/cors.ts';

type RevenueCatWebhookPayload = {
    api_version?: string;
    event?: RevenueCatWebhookEvent;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function getRequiredEnv() {
    const required = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        REVENUECAT_WEBHOOK_AUTHORIZATION: Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION') ?? '',
    };

    const missing = Object.entries(required)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    return { required, missing };
}

function sanitizeErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';

    if (/authorization|service_role|supabase/i.test(message)) {
        return 'Webhook processing failed';
    }

    return message;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const { required, missing } = getRequiredEnv();
        if (missing.length > 0) {
            return jsonResponse(500, { error: `Missing function environment variables: ${missing.join(', ')}` });
        }

        const authorization = req.headers.get('Authorization');
        if (!authorization || authorization !== required.REVENUECAT_WEBHOOK_AUTHORIZATION) {
            return jsonResponse(401, { error: 'Unauthorized webhook request' });
        }

        const payload = (await req.json()) as RevenueCatWebhookPayload;
        const event = payload.event;

        if (!event?.id || !event?.type) {
            return jsonResponse(400, { error: 'Invalid RevenueCat webhook payload' });
        }

        const adminSupabase = createClient(required.SUPABASE_URL, required.SUPABASE_SERVICE_ROLE_KEY) as any;
        const eventInsert = await adminSupabase.from('billing_events').insert({
            provider: 'revenuecat',
            event_id: event.id,
            event_type: event.type,
            payload,
        });

        if (eventInsert.error?.code === '23505') {
            return jsonResponse(200, { ok: true, duplicate: true });
        }

        if (eventInsert.error) {
            throw new Error(eventInsert.error.message);
        }

        if (!shouldUpsertSubscription(event.type)) {
            return jsonResponse(200, { ok: true, skipped: true });
        }

        const userId = resolveUserId(event);
        if (!userId) {
            return jsonResponse(200, { ok: true, skipped: true, reason: 'No matching Supabase user id in webhook payload' });
        }

        const mapped = mapRevenueCatEventToSubscription(event);
        const currentPeriodEnd = toIsoFromMs(event.expiration_at_ms);
        const latestPurchaseAt = toIsoFromMs(event.purchased_at_ms);
        const providerSubscriptionId = event.original_transaction_id ?? event.transaction_id ?? `${event.store ?? 'unknown'}:${event.product_id ?? 'unknown'}:${userId}`;
        const productId = event.product_id ?? null;
        const entitlementId = event.entitlement_ids?.[0] ?? event.entitlement_id ?? null;

        const { error: subscriptionError } = await adminSupabase.from('subscriptions').upsert(
            {
                user_id: userId,
                provider: 'revenuecat',
                provider_subscription_id: providerSubscriptionId,
                product_id: productId,
                base_plan_id: parseBasePlanId(productId, event.store),
                offer_id: event.presented_offering_id ?? null,
                order_id: event.transaction_id ?? null,
                purchase_token: null,
                status: mapped.status,
                current_period_end: currentPeriodEnd,
                cancel_at_period_end: mapped.cancelAtPeriodEnd,
                acknowledged: null,
                auto_renewing: mapped.cancelAtPeriodEnd ? false : null,
                latest_purchase_at: latestPurchaseAt,
                canceled_at: mapped.canceledAt,
                raw_payload: payload,
                entitlement_source: getEntitlementSource(event),
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'provider,provider_subscription_id' },
        );

        if (subscriptionError) {
            throw new Error(subscriptionError.message);
        }

        return jsonResponse(200, {
            ok: true,
            status: mapped.status,
            userId,
            providerSubscriptionId,
            entitlementId,
        });
    } catch (error: unknown) {
        return jsonResponse(400, { error: sanitizeErrorMessage(error) });
    }
});
