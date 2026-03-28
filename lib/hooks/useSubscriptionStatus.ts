import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'lib/auth';
import { supabase } from 'lib/supabase';

type SubscriptionStatusRow = {
    provider: string | null;
    status: string | null;
    current_period_end: string | null;
};

type UseSubscriptionStatusOptions = {
    pollAfterReturn?: boolean;
};

export function subscriptionStatusQueryKey(userId?: string | null) {
    return ['subscriptionStatus', userId ?? 'anonymous'];
}

async function fetchSubscriptionStatus(userId: string): Promise<SubscriptionStatusRow> {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('provider,status,current_period_end')
        .eq('user_id', userId)
        .eq('provider', 'google_play')
        .order('current_period_end', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return {
        provider: data?.provider ?? null,
        status: data?.status ?? null,
        current_period_end: data?.current_period_end ?? null,
    };
}

function isActiveSubscription(status: string | null, currentPeriodEnd: string | null) {
    if (!status || !['active', 'trialing', 'grace_period'].includes(status)) {
        return false;
    }

    if (!currentPeriodEnd) {
        return true;
    }

    return new Date(currentPeriodEnd).getTime() > Date.now();
}

export function useSubscriptionStatus(options?: UseSubscriptionStatusOptions) {
    const { user } = useAuth();
    const query = useQuery({
        queryKey: subscriptionStatusQueryKey(user?.id),
        queryFn: () => fetchSubscriptionStatus(user!.id),
        enabled: Boolean(user?.id),
        staleTime: options?.pollAfterReturn ? 0 : 1000 * 30,
        refetchInterval: options?.pollAfterReturn ? 4000 : false,
        refetchIntervalInBackground: false,
    });

    const isActive = isActiveSubscription(query.data?.status ?? null, query.data?.current_period_end ?? null);

    useEffect(() => {
        // Stop the short polling loop once access becomes active.
        if (options?.pollAfterReturn && isActive) {
            void query.refetch();
        }
    }, [isActive, options?.pollAfterReturn]);

    return {
        ...query,
        status: query.data?.status ?? null,
        currentPeriodEnd: query.data?.current_period_end ?? null,
        isActiveSubscription: isActive,
    };
}