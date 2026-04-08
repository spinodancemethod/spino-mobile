import {
    getEntitlementSource,
    mapRevenueCatEventToSubscription,
    parseBasePlanId,
    resolveUserId,
    shouldUpsertSubscription,
    toIsoFromMs,
} from './revenuecatWebhookMapping';

describe('revenuecatWebhookMapping', () => {
    const now = Date.UTC(2026, 3, 4, 12, 0, 0);

    it('maps active purchase events to active status', () => {
        const result = mapRevenueCatEventToSubscription({
            type: 'INITIAL_PURCHASE',
            period_type: 'NORMAL',
            event_timestamp_ms: now,
        }, now);

        expect(result).toEqual({
            status: 'active',
            cancelAtPeriodEnd: false,
            canceledAt: null,
        });
    });

    it('maps trial purchases to trialing status', () => {
        const result = mapRevenueCatEventToSubscription({
            type: 'RENEWAL',
            period_type: 'TRIAL',
            event_timestamp_ms: now,
        }, now);

        expect(result.status).toBe('trialing');
    });

    it('keeps access active for future-dated cancellations', () => {
        const result = mapRevenueCatEventToSubscription({
            type: 'CANCELLATION',
            period_type: 'NORMAL',
            event_timestamp_ms: now,
            expiration_at_ms: now + 86_400_000,
        }, now);

        expect(result).toEqual({
            status: 'active',
            cancelAtPeriodEnd: true,
            canceledAt: '2026-04-04T12:00:00.000Z',
        });
    });

    it('maps billing-error cancellations to grace period', () => {
        const result = mapRevenueCatEventToSubscription({
            type: 'CANCELLATION',
            cancel_reason: 'BILLING_ERROR',
            event_timestamp_ms: now,
        }, now);

        expect(result.status).toBe('grace_period');
        expect(result.cancelAtPeriodEnd).toBe(false);
    });

    it('maps expired paused subscriptions to paused status', () => {
        const result = mapRevenueCatEventToSubscription({
            type: 'EXPIRATION',
            expiration_reason: 'SUBSCRIPTION_PAUSED',
            event_timestamp_ms: now,
        }, now);

        expect(result.status).toBe('paused');
    });

    it('maps billing issue events with grace period to grace_period status', () => {
        const result = mapRevenueCatEventToSubscription({
            type: 'BILLING_ISSUE',
            grace_period_expiration_at_ms: now + 10_000,
        }, now);

        expect(result.status).toBe('grace_period');
    });

    it('extracts a Play Store base plan id from RevenueCat product ids', () => {
        expect(parseBasePlanId('spino_monthly:monthly-base', 'PLAY_STORE')).toBe('monthly-base');
        expect(parseBasePlanId('spino_monthly', 'APP_STORE')).toBeNull();
    });

    it('resolves Supabase user ids from aliases and transferred users', () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';

        expect(resolveUserId({ aliases: ['$RCAnonymousID:123', userId] })).toBe(userId);
        expect(resolveUserId({ transferred_to: ['not-a-uuid', userId] })).toBe(userId);
    });

    it('produces RevenueCat entitlement sources and ISO timestamps', () => {
        expect(getEntitlementSource({ store: 'PLAY_STORE' })).toBe('revenuecat_webhook:play_store');
        expect(toIsoFromMs(now)).toBe('2026-04-04T12:00:00.000Z');
    });

    it('tracks only subscription lifecycle events for upserts', () => {
        expect(shouldUpsertSubscription('INITIAL_PURCHASE')).toBe(true);
        expect(shouldUpsertSubscription('EXPERIMENT_ENROLLMENT')).toBe(false);
    });
});