/// <reference path="../_shared/edge-runtime-types.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type VerifyGooglePlayPurchasePayload = {
    packageName?: string;
    purchaseToken?: string;
    productId?: string;
    basePlanId?: string;
};

type GoogleErrorResponse = {
    error?: {
        message?: string;
    };
};

function jsonResponse(status: number, body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function normalizePrivateKey(input: string) {
    // Supabase secrets usually store multiline private keys with literal \n.
    return input.replace(/\\n/g, '\n');
}

function toBase64Url(bytes: Uint8Array) {
    const bin = String.fromCharCode(...bytes);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textToBase64Url(text: string) {
    return toBase64Url(new TextEncoder().encode(text));
}

function pemToArrayBuffer(pem: string) {
    const cleaned = pem
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s+/g, '');

    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function signJwtRS256(unsignedToken: string, privateKeyPem: string) {
    const keyData = pemToArrayBuffer(privateKeyPem);
    const key = await crypto.subtle.importKey(
        'pkcs8',
        keyData,
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['sign'],
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(unsignedToken),
    );

    return toBase64Url(new Uint8Array(signature));
}

async function getGoogleApiAccessToken(serviceAccountEmail: string, privateKey: string) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: serviceAccountEmail,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        exp: nowSeconds + 3600,
        iat: nowSeconds,
    };

    const unsignedToken = `${textToBase64Url(JSON.stringify(header))}.${textToBase64Url(JSON.stringify(payload))}`;
    const signature = await signJwtRS256(unsignedToken, privateKey);
    const assertion = `${unsignedToken}.${signature}`;

    const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    const data = await response.json();
    if (!response.ok || !data?.access_token) {
        throw new Error(data?.error_description ?? data?.error ?? 'Failed to get Google access token');
    }

    return data.access_token as string;
}

function mapPlaySubscriptionState(rawState: string | null) {
    switch (rawState) {
        case 'SUBSCRIPTION_STATE_ACTIVE':
            return 'active';
        case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
            return 'grace_period';
        case 'SUBSCRIPTION_STATE_ON_HOLD':
            return 'on_hold';
        case 'SUBSCRIPTION_STATE_PAUSED':
            return 'paused';
        case 'SUBSCRIPTION_STATE_CANCELED':
            return 'canceled';
        case 'SUBSCRIPTION_STATE_EXPIRED':
            return 'expired';
        case 'SUBSCRIPTION_STATE_PENDING':
            return 'pending';
        default:
            return 'expired';
    }
}

function toIsoOrNull(value: string | undefined) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

function getRequiredEnv() {
    const required = {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL') ?? '',
        GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY') ?? '',
    };

    const missing = Object.entries(required)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    return {
        required,
        missing,
        defaultAndroidPackageName: Deno.env.get('GOOGLE_PLAY_ANDROID_PACKAGE_NAME') ?? '',
    };
}

function sanitizeErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    // Keep prod error responses generic for external upstream/auth failures.
    if (
        /oauth2\.googleapis\.com|androidpublisher\.googleapis\.com|jwt|private key|service account/i.test(message)
    ) {
        return 'Google Play verification failed';
    }

    return message;
}

function parseJsonBody(req: Request): Promise<VerifyGooglePlayPurchasePayload> {
    return req.json() as Promise<VerifyGooglePlayPurchasePayload>;
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const { required, missing, defaultAndroidPackageName } = getRequiredEnv();

        if (missing.length > 0) {
            return jsonResponse(500, {
                error: `Missing function environment variables: ${missing.join(', ')}`,
            });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse(401, { error: 'Missing Authorization header' });
        }

        const userSupabase = createClient(required.SUPABASE_URL, required.SUPABASE_ANON_KEY, {
            global: {
                headers: { Authorization: authHeader },
            },
        });

        const adminSupabase = createClient(required.SUPABASE_URL, required.SUPABASE_SERVICE_ROLE_KEY);

        const token = authHeader.replace('Bearer ', '');
        const {
            data: { user },
            error: userError,
        } = await userSupabase.auth.getUser(token);

        if (userError || !user) {
            return jsonResponse(401, { error: 'Unauthorized' });
        }

        const payload = await parseJsonBody(req);
        const packageName = payload.packageName ?? defaultAndroidPackageName;
        const purchaseToken = payload.purchaseToken;

        if (!packageName) {
            return jsonResponse(400, { error: 'packageName is required (or set GOOGLE_PLAY_ANDROID_PACKAGE_NAME)' });
        }

        if (!purchaseToken) {
            return jsonResponse(400, { error: 'purchaseToken is required' });
        }

        const accessToken = await getGoogleApiAccessToken(
            required.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
            normalizePrivateKey(required.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY),
        );

        // subscriptionsv2 endpoint uses only package + token and returns line items.
        const verifyUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
            packageName,
        )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

        const verifyResponse = await fetch(verifyUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const purchase = await verifyResponse.json();
        if (!verifyResponse.ok) {
            const purchaseError = purchase as GoogleErrorResponse;
            return jsonResponse(400, {
                error: purchaseError?.error?.message ?? 'Google Play verification failed',
            });
        }

        const subscriptionState = purchase?.subscriptionState ?? null;
        const mappedStatus = mapPlaySubscriptionState(subscriptionState);
        const latestOrderId = purchase?.latestOrderId ?? null;
        const acknowledgmentState = purchase?.acknowledgementState ?? null;
        const externalAccountId =
            purchase?.externalAccountIdentifiers?.obfuscatedExternalAccountId ??
            purchase?.externalAccountIdentifiers?.obfuscatedExternalProfileId ??
            null;

        // Line item shape can vary over time; keep extraction defensive.
        const firstLineItem = purchase?.lineItems?.[0] ?? null;
        const productId = payload.productId ?? firstLineItem?.productId ?? null;
        const basePlanId =
            payload.basePlanId ??
            firstLineItem?.offerDetails?.basePlanId ??
            firstLineItem?.autoRenewingPlan?.basePlanId ??
            null;
        const offerId = firstLineItem?.offerDetails?.offerId ?? null;
        const expiryIso = toIsoOrNull(firstLineItem?.expiryTime);
        const autoRenewing =
            Boolean(firstLineItem?.autoRenewingPlan) ||
            firstLineItem?.autoRenewEnabled === true ||
            false;

        // Upsert account mapping only if Google provides an account-level identifier.
        if (externalAccountId) {
            const { error: accountError } = await adminSupabase.from('billing_provider_accounts').upsert(
                {
                    user_id: user.id,
                    provider: 'google_play',
                    provider_account_id: externalAccountId,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,provider' },
            );

            if (accountError) {
                throw new Error(accountError.message);
            }
        }

        // Use purchase token as the provider subscription identity for now.
        const { error: subscriptionError } = await adminSupabase.from('subscriptions').upsert(
            {
                user_id: user.id,
                provider: 'google_play',
                provider_subscription_id: purchaseToken,
                product_id: productId,
                base_plan_id: basePlanId,
                offer_id: offerId,
                order_id: latestOrderId,
                purchase_token: purchaseToken,
                status: mappedStatus,
                current_period_end: expiryIso,
                cancel_at_period_end: false,
                acknowledged: acknowledgmentState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
                auto_renewing: autoRenewing,
                latest_purchase_at: new Date().toISOString(),
                raw_payload: purchase,
                entitlement_source: 'google_play_api',
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'provider,provider_subscription_id' },
        );

        if (subscriptionError) {
            throw new Error(subscriptionError.message);
        }

        // Store a generic idempotency/debug event row.
        const syntheticEventId = `verify:google_play:${purchaseToken}:${latestOrderId ?? 'no-order-id'}`;
        const { error: eventError } = await adminSupabase.from('billing_events').insert({
            provider: 'google_play',
            event_id: syntheticEventId,
            event_type: 'verification.manual_or_client_triggered',
            payload: purchase,
        });

        if (eventError && eventError.code !== '23505') {
            throw new Error(eventError.message);
        }

        const hasAccess = ['active', 'trialing', 'grace_period'].includes(mappedStatus) && (!expiryIso || new Date(expiryIso).getTime() > Date.now());

        return jsonResponse(200, {
            ok: true,
            status: mappedStatus,
            currentPeriodEnd: expiryIso,
            hasAccess,
            productId,
            basePlanId,
            orderId: latestOrderId,
        });
    } catch (error: unknown) {
        return jsonResponse(400, { error: sanitizeErrorMessage(error) });
    }
});
