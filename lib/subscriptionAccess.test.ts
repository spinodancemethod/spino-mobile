import { hasActiveSubscription } from './subscriptionAccess';

describe('hasActiveSubscription', () => {
    const now = Date.UTC(2026, 2, 28, 12, 0, 0);

    it('returns true for active with future period end', () => {
        const result = hasActiveSubscription('active', '2026-04-01T00:00:00.000Z', now);
        expect(result).toBe(true);
    });

    it('returns false for active with past period end', () => {
        const result = hasActiveSubscription('active', '2026-03-01T00:00:00.000Z', now);
        expect(result).toBe(false);
    });

    it('returns true for trialing with no end date', () => {
        const result = hasActiveSubscription('trialing', null, now);
        expect(result).toBe(true);
    });

    it('returns false for canceled status', () => {
        const result = hasActiveSubscription('canceled', '2026-04-01T00:00:00.000Z', now);
        expect(result).toBe(false);
    });
});
