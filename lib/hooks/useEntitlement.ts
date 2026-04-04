import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';

// The two possible plan tiers a user can be on.
export type PlanTier = 'paid' | 'free';

export type EntitlementResult = {
    // Whether the user has an active paid subscription.
    isSubscribed: boolean;
    // 'paid' when subscribed, 'free' otherwise.
    planTier: PlanTier;
    // True while the entitlement check is in flight.
    isLoading: boolean;
};

export function entitlementQueryKey(userId?: string | null) {
    return ['entitlement', userId ?? 'anonymous'];
}

// Calls the existing has_active_subscription RPC which is already used by
// the dashboard layout and the RLS policies. Returns a plain boolean.
async function fetchEntitlement(userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('has_active_subscription', { p_user_id: userId });
    if (error) throw error;
    return Boolean(data);
}

// Central entitlement hook for the app.
//
// Replaces the ad-hoc subscription checks that previously lived in:
//   - app/(private)/(dashboard)/_layout.tsx  (fetchDashboardEntitlement)
//   - app/(private)/video/[id].tsx           (useSubscriptionStatus)
//
// Usage:
//   const { isSubscribed, planTier, isLoading } = useEntitlement();
export function useEntitlement(): EntitlementResult {
    const { user, loading: authLoading } = useAuth();

    const query = useQuery({
        queryKey: entitlementQueryKey(user?.id),
        queryFn: () => fetchEntitlement(user!.id),
        // Only run when auth has resolved and we have a user.
        enabled: !authLoading && Boolean(user?.id),
        // Short stale time so it re-checks quickly after a purchase.
        staleTime: 1000 * 20,
        refetchOnWindowFocus: false,
    });

    const isSubscribed = Boolean(query.data);

    return {
        isSubscribed,
        planTier: isSubscribed ? 'paid' : 'free',
        // Loading while auth is resolving OR the RPC is in flight.
        isLoading: authLoading || query.isLoading,
    };
}
