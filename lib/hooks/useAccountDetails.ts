import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';
import { hasActiveSubscription } from 'lib/subscriptionAccess';

type SubscriptionRow = {
    provider: string | null;
    status: string | null;
    current_period_end: string | null;
    product_id: string | null;
    base_plan_id: string | null;
    cancel_at_period_end: boolean | null;
};

export type AccountDetails = {
    userId: string;
    email: string | null;
    createdAt: string | null;
    subscriptionProvider: string | null;
    subscriptionStatus: string | null;
    subscriptionProductId: string | null;
    subscriptionBasePlanId: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasActiveSubscription: boolean;
};

export function accountDetailsQueryKey(userId?: string | null) {
    return ['accountDetails', userId ?? 'anonymous'];
}

async function fetchAccountDetails(userId: string, email: string | null, createdAt: string | null): Promise<AccountDetails> {
    const { data: subscriptionRow, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('provider,status,current_period_end,product_id,base_plan_id,cancel_at_period_end')
        .eq('user_id', userId)
        .eq('provider', 'google_play')
        .order('current_period_end', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle<SubscriptionRow>();

    if (subscriptionError) {
        throw subscriptionError;
    }

    return {
        userId,
        email,
        createdAt,
        subscriptionProvider: subscriptionRow?.provider ?? null,
        subscriptionStatus: subscriptionRow?.status ?? null,
        subscriptionProductId: subscriptionRow?.product_id ?? null,
        subscriptionBasePlanId: subscriptionRow?.base_plan_id ?? null,
        currentPeriodEnd: subscriptionRow?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(subscriptionRow?.cancel_at_period_end),
        hasActiveSubscription: hasActiveSubscription(
            subscriptionRow?.status ?? null,
            subscriptionRow?.current_period_end ?? null,
        ),
    };
}

export function useAccountDetails() {
    const { user } = useAuth();

    return useQuery({
        queryKey: accountDetailsQueryKey(user?.id),
        queryFn: () => fetchAccountDetails(user!.id, user?.email ?? null, (user as any)?.created_at ?? null),
        enabled: Boolean(user?.id),
        staleTime: 1000 * 30,
    });
}
