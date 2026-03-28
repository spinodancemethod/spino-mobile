import {
    shouldRedirectForEntitlement,
    shouldShowEntitlementPendingState,
} from './entitlementGuards';

describe('entitlementGuards', () => {
    it('redirects when not loading and no access', () => {
        expect(shouldRedirectForEntitlement({ isLoading: false, hasAccess: false })).toBe(true);
    });

    it('does not redirect when access is granted (paid or free tier)', () => {
        expect(shouldRedirectForEntitlement({ isLoading: false, hasAccess: true })).toBe(false);
    });

    it('does not redirect while loading', () => {
        expect(shouldRedirectForEntitlement({ isLoading: true, hasAccess: false })).toBe(false);
    });

    it('shows pending while loading', () => {
        expect(shouldShowEntitlementPendingState({ isLoading: true, hasAccess: false })).toBe(true);
    });

    it('does not show pending when access is active', () => {
        expect(shouldShowEntitlementPendingState({ isLoading: false, hasAccess: true })).toBe(false);
    });

    it('shows pending for free-tier path only when caller marks access as unavailable', () => {
        expect(shouldShowEntitlementPendingState({ isLoading: false, hasAccess: false })).toBe(true);
    });
});
