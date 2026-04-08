export type RevenueCatWebhookEvent = {
    id?: string;
    type?: string;
    app_user_id?: string | null;
    original_app_user_id?: string | null;
    aliases?: string[] | null;
    transferred_to?: string[] | null;
    product_id?: string | null;
    entitlement_ids?: string[] | null;
    entitlement_id?: string | null;
    original_transaction_id?: string | null;
    transaction_id?: string | null;
    purchased_at_ms?: number | null;
    event_timestamp_ms?: number | null;
    expiration_at_ms?: number | null;
    grace_period_expiration_at_ms?: number | null;
    auto_resume_at_ms?: number | null;
    store?: string | null;
    period_type?: string | null;
    cancel_reason?: string | null;
    expiration_reason?: string | null;
    environment?: string | null;
    presented_offering_id?: string | null;
};

export type SubscriptionProjection = {
    status: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
};

export function isUuidLike(value: string | null | undefined) {
    if (!value) {
        return false;
    }

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function toIsoFromMs(value?: number | null) {
    if (!value || !Number.isFinite(value)) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
}

export function getUserIdCandidates(event: RevenueCatWebhookEvent) {
    return [
        event.app_user_id,
        event.original_app_user_id,
        ...(event.transferred_to ?? []),
        ...(event.aliases ?? []),
    ].filter((value): value is string => Boolean(value));
}

export function resolveUserId(event: RevenueCatWebhookEvent) {
    return getUserIdCandidates(event).find((candidate) => isUuidLike(candidate)) ?? null;
}

export function parseBasePlanId(productId?: string | null, store?: string | null) {
    if (!productId || store !== 'PLAY_STORE') {
        return null;
    }

    const [, basePlanId] = productId.split(':');
    return basePlanId ?? null;
}

export function getEntitlementSource(event: RevenueCatWebhookEvent) {
    return event.store ? `revenuecat_webhook:${event.store.toLowerCase()}` : 'revenuecat_webhook';
}

export function hasFutureExpiration(expirationAtMs?: number | null, nowMs = Date.now()) {
    return Boolean(expirationAtMs && expirationAtMs > nowMs);
}

export function mapRevenueCatEventToSubscription(
    event: RevenueCatWebhookEvent,
    nowMs = Date.now(),
): SubscriptionProjection {
    const cancellationAt = toIsoFromMs(event.event_timestamp_ms);

    switch (event.type) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
        case 'PRODUCT_CHANGE':
        case 'UNCANCELLATION':
        case 'SUBSCRIPTION_EXTENDED':
        case 'TRANSFER':
            return {
                status: event.period_type === 'TRIAL' ? 'trialing' : 'active',
                cancelAtPeriodEnd: false,
                canceledAt: null,
            };
        case 'NON_RENEWING_PURCHASE':
            return {
                status: event.period_type === 'TRIAL' ? 'trialing' : 'active',
                cancelAtPeriodEnd: true,
                canceledAt: null,
            };
        case 'TEMPORARY_ENTITLEMENT_GRANT':
            return {
                status: 'active',
                cancelAtPeriodEnd: false,
                canceledAt: null,
            };
        case 'BILLING_ISSUE':
            return {
                status: event.grace_period_expiration_at_ms ? 'grace_period' : 'past_due',
                cancelAtPeriodEnd: false,
                canceledAt: null,
            };
        case 'CANCELLATION':
            if (event.cancel_reason === 'BILLING_ERROR') {
                return {
                    status: 'grace_period',
                    cancelAtPeriodEnd: false,
                    canceledAt: cancellationAt,
                };
            }

            if (hasFutureExpiration(event.expiration_at_ms, nowMs)) {
                return {
                    status: event.period_type === 'TRIAL' ? 'trialing' : 'active',
                    cancelAtPeriodEnd: true,
                    canceledAt: cancellationAt,
                };
            }

            return {
                status: 'canceled',
                cancelAtPeriodEnd: true,
                canceledAt: cancellationAt,
            };
        case 'SUBSCRIPTION_PAUSED':
            return {
                status: hasFutureExpiration(event.expiration_at_ms, nowMs) ? 'active' : 'paused',
                cancelAtPeriodEnd: true,
                canceledAt: cancellationAt,
            };
        case 'EXPIRATION':
            return {
                status: event.expiration_reason === 'SUBSCRIPTION_PAUSED' ? 'paused' : 'expired',
                cancelAtPeriodEnd: true,
                canceledAt: cancellationAt,
            };
        default:
            return {
                status: hasFutureExpiration(event.expiration_at_ms, nowMs) ? 'active' : 'expired',
                cancelAtPeriodEnd: false,
                canceledAt: null,
            };
    }
}

export function shouldUpsertSubscription(eventType?: string) {
    return Boolean(
        eventType && [
            'INITIAL_PURCHASE',
            'RENEWAL',
            'CANCELLATION',
            'UNCANCELLATION',
            'NON_RENEWING_PURCHASE',
            'SUBSCRIPTION_PAUSED',
            'EXPIRATION',
            'BILLING_ISSUE',
            'PRODUCT_CHANGE',
            'TRANSFER',
            'SUBSCRIPTION_EXTENDED',
            'TEMPORARY_ENTITLEMENT_GRANT',
        ].includes(eventType),
    );
}